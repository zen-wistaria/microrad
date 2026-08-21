/**
 * CoA / Disconnect-Request (RFC 5176) — kirim dari server ke NAS MikroTik
 * via radclient (binary FreeRADIUS) di port 3799.
 *
 * Digunakan untuk:
 *  - Disconnect sesi aktif (Disconnect-Request + User-Name)
 *  - Push perubahan bandwidth tanpa disconnect (CoA-Request +
 *    Mikrotik-Rate-Limit) saat pelanggan pindah profil
 *
 * Prasyarat sisi router: /radius incoming set accept=yes port=3799
 * (ditambahkan otomatis oleh configureRadiusOnRouter).
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface CoaResult {
  success: boolean;
  code?: string; // CoA-ACK | CoA-NAK | Disconnect-ACK ...
  raw: string;
}

/** Jalankan radclient di container FreeRADIUS (binary ada di sana). */
async function runRadclient(
  packet: string[],
  type: "coa" | "disconnect",
  radiusIp: string,
  secret: string,
): Promise<string> {
  const input = packet.join("\n");
  // radclient membaca packet dari stdin; -x verbose; timeout 10s
  const cmd = [
    "docker exec",
    "-i",
    "microrad-freeradius",
    "radclient",
    "-x",
    "-t",
    "10",
    `${radiusIp}:3799`,
    type,
    secret,
  ].join(" ");
  const { stdout, stderr } = await execAsync(
    `printf '%s' ${JSON.stringify(input + "\n")} | ${cmd} 2>&1`,
    {
      timeout: 15_000,
    },
  );
  return `${stdout}\n${stderr}`.trim();
}

/** Kirim Disconnect-Request utk satu user (best-effort). */
export async function sendDisconnect(
  username: string,
  opts: {
    acctSessionId?: string;
    radiusIp?: string;
    secret?: string;
  } = {},
): Promise<CoaResult> {
  const packet = [`User-Name = "${username}"`];
  if (opts.acctSessionId) {
    packet.push(`Acct-Session-Id = "${opts.acctSessionId}"`);
  }
  return sendPacket(packet, "disconnect", opts);
}

/** Kirim CoA-Request dengan atribut baru (mis. Mikrotik-Rate-Limit). */
export async function sendCoa(
  username: string,
  attrs: Record<string, string>,
  opts: {
    acctSessionId?: string;
    radiusIp?: string;
    secret?: string;
  } = {},
): Promise<CoaResult> {
  const packet = [`User-Name = "${username}"`];
  if (opts.acctSessionId) {
    packet.push(`Acct-Session-Id = "${opts.acctSessionId}"`);
  }
  for (const [k, v] of Object.entries(attrs)) {
    packet.push(`${k} = "${v.replace(/"/g, '\\"')}"`);
  }
  return sendPacket(packet, "coa", opts);
}

async function sendPacket(
  packet: string[],
  type: "coa" | "disconnect",
  opts: { radiusIp?: string; secret?: string },
): Promise<CoaResult> {
  try {
    const radiusIp = opts.radiusIp ?? process.env.FREERADIUS_IP ?? "172.30.0.3";
    const secret =
      opts.secret ?? process.env.RADIUS_DEFAULT_SECRET ?? "testing123";
    const raw = await runRadclient(packet, type, radiusIp, secret);
    const m = raw.match(/(CoA-ACK|CoA-NAK|Disconnect-ACK|Disconnect-NAK)/);
    const code = m?.[1];
    return { success: code?.includes("ACK") ?? false, code, raw };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, raw: msg };
  }
}
