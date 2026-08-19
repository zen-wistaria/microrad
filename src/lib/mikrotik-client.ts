/**
 * Klien RouterOS API (protokol binari asli, tanpa library eksternal).
 *
 * node-routeros v1.6.9 gagal mem-parse reply "!empty" dari RouterOS 7
 * ("Tried to process unknown reply") — jadi kita implementasi protokol
 * sendiri (dokumentasi resmi RouterOS API: length-prefixed sentences,
 * reply dimulai "!", paket diakhiri byte 0).
 *
 * Dipakai: sinkronisasi sesi PPPoE, ping, kick sesi, konfigurasi radius.
 */
import net from "node:net";

export interface MikrotikConn {
  /** Jalankan command: path + params, kembalikan baris reply. */
  write(path: string, params?: string[]): Promise<Record<string, string>[]>;
  close(): void;
}

const TIMEOUT_MS = () => Number(process.env.MIKROTIK_SYNC_TIMEOUT_MS ?? "5000");

/** Kirim satu "sentence" (daftar word) sesuai framing protokol API. */
function encodeSentence(words: string[]): Buffer {
  const parts: Buffer[] = [];
  for (const w of words) {
    const b = Buffer.from(w, "utf8");
    const len = b.length;
    if (len < 0x80) {
      parts.push(Buffer.from([len]), b);
    } else if (len < 0x4000) {
      parts.push(Buffer.from([0x80 | (len >> 8), len & 0xff]), b);
    } else if (len < 0x200000) {
      parts.push(
        Buffer.from([0xc0 | (len >> 16), (len >> 8) & 0xff, len & 0xff]),
        b,
      );
    } else {
      parts.push(
        Buffer.from([
          0xe0 | (len >> 24),
          (len >> 16) & 0xff,
          (len >> 8) & 0xff,
          len & 0xff,
        ]),
        b,
      );
    }
  }
  parts.push(Buffer.from([0])); // akhir paket
  return Buffer.concat(parts);
}

/** Parse stream byte → daftar paket (tiap paket = daftar sentence). */
function parsePackets(buf: Buffer): { packets: string[][]; consumed: number } {
  const packets: string[][] = [];
  let i = 0;
  while (i < buf.length) {
    const sentences: string[] = [];
    while (i < buf.length && buf[i] !== 0) {
      let len = buf[i++];
      if (len & 0x80) {
        if ((len & 0xc0) === 0x80) {
          len = ((len & 0x3f) << 8) + buf[i++];
        } else if ((len & 0xe0) === 0xc0) {
          len = ((len & 0x1f) << 8) + buf[i++];
          len = (len << 8) + buf[i++];
        } else if ((len & 0xf0) === 0xe0) {
          len = ((len & 0x0f) << 8) + buf[i++];
          len = (len << 8) + buf[i++];
          len = (len << 8) + buf[i++];
        }
      }
      sentences.push(buf.subarray(i, i + len).toString("utf8"));
      i += len;
    }
    i += 1; // lewati byte 0 (akhir paket)
    packets.push(sentences);
  }
  return { packets, consumed: i };
}

/** Konversi baris reply ("=key=value") menjadi objek. */
function rowToObject(packet: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const line of packet) {
    if (line.startsWith("=")) {
      const eq = line.indexOf("=", 1);
      const key = eq === -1 ? line.slice(1) : line.slice(1, eq);
      const value = eq === -1 ? "" : line.slice(eq + 1);
      obj[key] = value;
    }
  }
  return obj;
}

export function connectRouterOS(router: {
  ipAddress: string;
  apiPort?: number;
  apiUsername?: string | null;
  apiPassword?: string | null;
}): Promise<MikrotikConn> {
  if (!router.apiUsername) {
    return Promise.reject(
      new Error("Kredensial API RouterOS belum diisi pada router ini."),
    );
  }
  const host = router.ipAddress;
  const port = router.apiPort ?? 8728;
  const timeoutMs = TIMEOUT_MS();

  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    let settled = false;
    let buffer = Buffer.alloc(0);
    let loggedIn = false;
    let tagCounter = 0;
    let failTimer: NodeJS.Timeout;

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(failTimer);
      socket.destroy();
      reject(err instanceof Error ? err : new Error(messageRouterosError(err)));
    };

    const timeout = () => {
      fail(new Error("Tidak dapat terhubung ke router (timeout)."));
    };

    socket.setTimeout(timeoutMs, timeout);
    socket.on("error", (e) => {
      const code = (e as NodeJS.ErrnoException)?.code;
      fail(
        new Error(
          code === "ECONNREFUSED"
            ? "Tidak dapat terhubung ke router (koneksi ditolak)."
            : `Tidak dapat terhubung ke router (${code ?? e?.message}).`,
        ),
      );
    });

    // Antrian command — satu per satu (protokol sequenced)
    const queue: {
      tag: string;
      path: string;
      params: string[];
      resolve: (rows: Record<string, string>[]) => void;
      reject: (err: Error) => void;
    }[] = [];
    let current: (typeof queue)[number] | null = null;
    const pendingRows: Record<string, string>[] = [];

    const sendNext = () => {
      if (current || queue.length === 0 || !loggedIn) return;
      const next = queue.shift();
      if (!next) return;
      current = next;
      const words = [current.path, ...current.params, `.tag=${current.tag}`];
      socket.write(encodeSentence(words));
    };

    const startLogin = () => {
      // Login 6.43+ (name/password plaintext — didukung semua RouterOS).
      // Password kosong (router default) → kirim string kosong, bukan null.
      const password = router.apiPassword ?? "";
      const words = [
        "/login",
        `=name=${router.apiUsername}`,
        `=password=${password}`,
      ];
      socket.write(encodeSentence(words));
    };

    const processData = () => {
      const { packets, consumed } = parsePackets(buffer);
      if (consumed === 0) return;
      buffer = buffer.subarray(consumed);
      for (const p of packets) {
        const first = p[0] ?? "";
        if (first === "!done") {
          if (!loggedIn) {
            loggedIn = true;
            sendNext();
          } else if (current) {
            current.resolve(pendingRows.splice(0));
            current = null;
            sendNext();
          }
        } else if (first === "!trap" || first === "!fatal") {
          const msg =
            p.find((l) => l.startsWith("=message="))?.slice(9) ?? first;
          if (current) {
            current.reject(new Error(msg));
            current = null;
          } else {
            fail(new Error(msg));
          }
          sendNext();
        } else if (first === "!re" || first.startsWith("=")) {
          // "!re" = baris data reply; baris "=key=value" juga data
          pendingRows.push(rowToObject(p));
        }
        // "!empty" — tanpa data, tunggu !done
      }
    };

    socket.on("data", (d) => {
      buffer = Buffer.concat([buffer, d]);
      if (!loggedIn) {
        processData();
        sendNext();
        return;
      }
      processData();
    });

    socket.on("connect", () => {
      failTimer = setTimeout(
        () => fail(new Error("Timeout login.")),
        timeoutMs,
      );
      startLogin();
    });

    const api: MikrotikConn = {
      write(path, params = []) {
        return new Promise((res, rej) => {
          queue.push({
            tag: `t${++tagCounter}`,
            path,
            params,
            resolve: res,
            reject: rej,
          });
          sendNext();
        });
      },
      close() {
        settled = true;
        clearTimeout(failTimer);
        socket.destroy();
      },
    };

    // connect error dulu — resolve setelah login OK
    socket.once("close", () => {
      if (!settled) fail(new Error("Koneksi ditutup."));
    });
    resolve(api);
  });
}

/** Pesan error ramah-manusia untuk kegagalan RouterOS API. */
export function messageRouterosError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes("refused") || lower.includes("connection")) {
    return "Tidak dapat terhubung ke router (koneksi ditolak/timeout).";
  }
  if (lower.includes("password") || lower.includes("user")) {
    return "Autentikasi API RouterOS gagal (username/password salah).";
  }
  return `Gagal berkomunikasi dengan router: ${raw}`;
}
