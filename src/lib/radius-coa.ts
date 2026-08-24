/**
 * CoA / Disconnect-Request (RFC 5176 / RFC 3576 / RFC 2865)
 * Pure TypeScript Native UDP Client (Port 3799).
 *
 * 100% Container-Ready (No Docker CLI, no exec, no external binaries).
 *
 * Digunakan untuk:
 *  - Disconnect sesi aktif PPPoE (Disconnect-Request Code 40)
 *  - Push perubahan QoS/bandwidth live (CoA-Request Code 43)
 *
 * Prasyarat router: /radius incoming set accept=yes port=3799
 */
import crypto from "node:crypto";
import dgram from "node:dgram";

export interface CoaResult {
  success: boolean;
  code?: string; // "Disconnect-ACK" | "Disconnect-NAK" | "CoA-ACK" | "CoA-NAK" | string
  raw: string;
}

export interface CoaOptions {
  acctSessionId?: string;
  framedIp?: string;
  nasIp?: string;
  radiusIp?: string;
  port?: number;
  secret?: string;
  timeoutMs?: number;
}

const RADIUS_CODE_DISCONNECT_REQUEST = 40;
const RADIUS_CODE_DISCONNECT_ACK = 41;
const RADIUS_CODE_COA_REQUEST = 43;
const RADIUS_CODE_COA_ACK = 44;

const CODE_NAMES: Record<number, string> = {
  40: "Disconnect-Request",
  41: "Disconnect-ACK",
  42: "Disconnect-NAK",
  43: "CoA-Request",
  44: "CoA-ACK",
  45: "CoA-NAK",
};

let packetIdCounter = 1;
function getNextPacketId(): number {
  packetIdCounter = (packetIdCounter + 1) % 256;
  return packetIdCounter;
}

/**
 * Encode standard RADIUS Attribute (TLV).
 */
function encodeAttribute(type: number, value: string | Buffer): Buffer {
  const valBuf = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  const len = 2 + valBuf.length;
  const buf = Buffer.alloc(len);
  buf.writeUInt8(type, 0);
  buf.writeUInt8(len, 1);
  valBuf.copy(buf, 2);
  return buf;
}

/**
 * Encode Vendor-Specific Attribute (Type 26).
 * MikroTik Vendor ID = 14988 (0x00003a8c)
 */
function encodeVendorSpecific(
  vendorId: number,
  vendorType: number,
  value: string,
): Buffer {
  const valBuf = Buffer.from(value, "utf8");
  const subLen = 2 + valBuf.length;
  const totalLen = 6 + subLen; // 2 byte header + 4 byte vendorId + subLen

  const buf = Buffer.alloc(totalLen);
  buf.writeUInt8(26, 0); // Type 26 (Vendor-Specific)
  buf.writeUInt8(totalLen, 1);
  buf.writeUInt32BE(vendorId, 2);
  buf.writeUInt8(vendorType, 6);
  buf.writeUInt8(subLen, 7);
  valBuf.copy(buf, 8);
  return buf;
}

/**
 * Encode IPv4 Attribute (Type 8 / Type 4).
 */
function encodeIpv4Attribute(type: number, ip: string): Buffer {
  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (
    parts.length !== 4 ||
    parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
  ) {
    return encodeAttribute(type, ip);
  }
  const buf = Buffer.alloc(6);
  buf.writeUInt8(type, 0);
  buf.writeUInt8(6, 1);
  buf.writeUInt8(parts[0], 2);
  buf.writeUInt8(parts[1], 3);
  buf.writeUInt8(parts[2], 4);
  buf.writeUInt8(parts[3], 5);
  return buf;
}

/**
 * Build RFC 5176 Request Packet with MD5 Request Authenticator.
 */
function buildRadiusRequestPacket(
  code: number,
  identifier: number,
  attributes: Buffer[],
  secret: string,
): Buffer {
  const attrsBuffer = Buffer.concat(attributes);
  const length = 20 + attrsBuffer.length;
  const packet = Buffer.alloc(length);

  packet.writeUInt8(code, 0);
  packet.writeUInt8(identifier, 1);
  packet.writeUInt16BE(length, 2);
  // RFC 5176: Request Authenticator is MD5(Code + ID + Length + 16-zeros + Attributes + Secret)
  packet.fill(0, 4, 20); // 16 zeros
  attrsBuffer.copy(packet, 20);

  const hash = crypto.createHash("md5");
  hash.update(packet);
  hash.update(Buffer.from(secret, "utf8"));
  const authenticator = hash.digest();

  authenticator.copy(packet, 4);
  return packet;
}

/**
 * Send UDP Packet and wait for response.
 */
async function sendUdpPacket(
  targetIp: string,
  targetPort: number,
  packet: Buffer,
  timeoutMs = 2000,
): Promise<{ code: number; codeName: string; raw: Buffer } | null> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    let timer: NodeJS.Timeout | null = null;
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      try {
        socket.close();
      } catch {}
    };

    timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    socket.on("message", (msg) => {
      cleanup();
      if (msg.length >= 20) {
        const code = msg.readUInt8(0);
        const codeName = CODE_NAMES[code] ?? `Code-${code}`;
        resolve({ code, codeName, raw: msg });
      } else {
        resolve(null);
      }
    });

    socket.on("error", () => {
      cleanup();
      resolve(null);
    });

    socket.send(packet, targetPort, targetIp, (err) => {
      if (err) {
        cleanup();
        resolve(null);
      }
    });
  });
}

/**
 * Kirim Disconnect-Request (RFC 5176) untuk memutus sesi PPPoE aktif.
 */
export async function sendDisconnect(
  username: string,
  opts: CoaOptions = {},
): Promise<CoaResult> {
  const targetIp =
    opts.nasIp ?? opts.radiusIp ?? process.env.FREERADIUS_IP ?? "172.30.0.3";
  const port = opts.port ?? 3799;
  const secret =
    opts.secret ?? process.env.RADIUS_DEFAULT_SECRET ?? "testing123";
  const timeoutMs = opts.timeoutMs ?? 2000;

  const attrs: Buffer[] = [];
  if (username) {
    attrs.push(encodeAttribute(1, username)); // User-Name
  }
  if (opts.acctSessionId) {
    attrs.push(encodeAttribute(44, opts.acctSessionId)); // Acct-Session-Id
  }
  if (opts.framedIp) {
    attrs.push(encodeIpv4Attribute(8, opts.framedIp)); // Framed-IP-Address
  }

  const id = getNextPacketId();
  const packet = buildRadiusRequestPacket(
    RADIUS_CODE_DISCONNECT_REQUEST,
    id,
    attrs,
    secret,
  );

  try {
    const res = await sendUdpPacket(targetIp, port, packet, timeoutMs);
    if (!res) {
      return {
        success: false,
        raw: `Timeout: tidak ada respon dari ${targetIp}:${port}`,
      };
    }
    const isAck = res.code === RADIUS_CODE_DISCONNECT_ACK;
    return {
      success: isAck,
      code: res.codeName,
      raw: `${res.codeName} received from ${targetIp}:${port}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, raw: msg };
  }
}

/**
 * Kirim CoA-Request (RFC 5176) untuk push perubahan atribut live (mis. Mikrotik-Rate-Limit).
 */
export async function sendCoa(
  username: string,
  attrsObj: Record<string, string>,
  opts: CoaOptions = {},
): Promise<CoaResult> {
  const targetIp =
    opts.nasIp ?? opts.radiusIp ?? process.env.FREERADIUS_IP ?? "172.30.0.3";
  const port = opts.port ?? 3799;
  const secret =
    opts.secret ?? process.env.RADIUS_DEFAULT_SECRET ?? "testing123";
  const timeoutMs = opts.timeoutMs ?? 2000;

  const attrs: Buffer[] = [];
  if (username) {
    attrs.push(encodeAttribute(1, username)); // User-Name
  }
  if (opts.acctSessionId) {
    attrs.push(encodeAttribute(44, opts.acctSessionId)); // Acct-Session-Id
  }
  if (opts.framedIp) {
    attrs.push(encodeIpv4Attribute(8, opts.framedIp)); // Framed-IP-Address
  }

  for (const [k, v] of Object.entries(attrsObj)) {
    if (k.toLowerCase() === "mikrotik-rate-limit") {
      // MikroTik Vendor ID = 14988, Subtype = 1
      attrs.push(encodeVendorSpecific(14988, 1, v));
    } else {
      // Default standard attribute string
      attrs.push(encodeAttribute(1, `${k}=${v}`));
    }
  }

  const id = getNextPacketId();
  const packet = buildRadiusRequestPacket(
    RADIUS_CODE_COA_REQUEST,
    id,
    attrs,
    secret,
  );

  try {
    const res = await sendUdpPacket(targetIp, port, packet, timeoutMs);
    if (!res) {
      return {
        success: false,
        raw: `Timeout: tidak ada respon dari ${targetIp}:${port}`,
      };
    }
    const isAck = res.code === RADIUS_CODE_COA_ACK;
    return {
      success: isAck,
      code: res.codeName,
      raw: `${res.codeName} received from ${targetIp}:${port}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, raw: msg };
  }
}
