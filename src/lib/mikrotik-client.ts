/**
 * Klien RouterOS API (protokol binari asli, tanpa library eksternal).
 *
 * Mendukung RouterOS v6 dan v7 (termasuk penanganan respon "!empty",
 * plaintext login v6.43+, dan legacy MD5 challenge-response).
 *
 * Dipakai: sinkronisasi sesi PPPoE, ping & test koneksi API, kick sesi, konfigurasi RADIUS.
 */
import crypto from "node:crypto";
import net from "node:net";

export interface MikrotikConn {
  /** Jalankan command: path + params, kembalikan baris reply. */
  write(path: string, params?: string[]): Promise<Record<string, string>[]>;
  close(): void;
}

const TIMEOUT_MS = () => Number(process.env.MIKROTIK_SYNC_TIMEOUT_MS ?? "2500");

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
    let packetComplete = false;
    const startI = i;

    while (i < buf.length) {
      if (buf[i] === 0) {
        i += 1;
        packetComplete = true;
        break;
      }
      let len = buf[i++];
      if (len & 0x80) {
        if ((len & 0xc0) === 0x80) {
          if (i >= buf.length) {
            i = startI;
            break;
          }
          len = ((len & 0x3f) << 8) + buf[i++];
        } else if ((len & 0xe0) === 0xc0) {
          if (i + 1 >= buf.length) {
            i = startI;
            break;
          }
          len = ((len & 0x1f) << 8) + buf[i++];
          len = (len << 8) + buf[i++];
        } else if ((len & 0xf0) === 0xe0) {
          if (i + 2 >= buf.length) {
            i = startI;
            break;
          }
          len = ((len & 0x0f) << 8) + buf[i++];
          len = (len << 8) + buf[i++];
          len = (len << 8) + buf[i++];
        }
      }

      if (i + len > buf.length) {
        i = startI;
        break;
      }

      sentences.push(buf.subarray(i, i + len).toString("utf8"));
      i += len;
    }

    if (packetComplete) {
      packets.push(sentences);
    } else {
      break;
    }
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

export function connectRouterOS(
  router: {
    ipAddress: string;
    apiPort?: number;
    apiUsername?: string | null;
    apiPassword?: string | null;
  },
  timeoutMsOverride?: number,
): Promise<MikrotikConn> {
  if (!router.apiUsername) {
    return Promise.reject(
      new Error("Kredensial API RouterOS belum diisi pada router ini."),
    );
  }
  const host = router.ipAddress;
  const port = router.apiPort ?? 8728;
  const timeoutMs = timeoutMsOverride ?? TIMEOUT_MS();

  return new Promise((resolve, reject) => {
    let settled = false;
    let buffer = Buffer.alloc(0);
    let loggedIn = false;
    let tagCounter = 0;
    let failTimer: NodeJS.Timeout | undefined;
    let connectTimer: NodeJS.Timeout | null = null;
    let loginChallengeRet: string | null = null;

    const socket = net.connect({ host, port });

    // Antrian command
    const queue: {
      tag: string;
      path: string;
      params: string[];
      timer?: NodeJS.Timeout;
      resolve: (rows: Record<string, string>[]) => void;
      reject: (err: Error) => void;
    }[] = [];
    let current: (typeof queue)[number] | null = null;
    const pendingRows: Record<string, string>[] = [];

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
      if (failTimer) {
        clearTimeout(failTimer);
      }
      if (current?.timer) {
        clearTimeout(current.timer);
      }
      socket.destroy();

      const errorObj =
        err instanceof Error ? err : new Error(messageRouterosError(err));
      if (current) {
        current.reject(errorObj);
        current = null;
      }
      while (queue.length > 0) {
        const item = queue.shift();
        item?.reject(errorObj);
      }
      reject(errorObj);
    };

    connectTimer = setTimeout(() => {
      fail(
        new Error(
          `Tidak dapat terhubung ke router ${host}:${port} (koneksi TCP timeout).`,
        ),
      );
    }, timeoutMs);

    socket.on("error", (e) => {
      const code = (e as NodeJS.ErrnoException)?.code;
      fail(
        new Error(
          code === "ECONNREFUSED"
            ? `Koneksi ditolak pada port API ${port} (${host}). Pastikan /ip service api aktif.`
            : `Tidak dapat terhubung ke port API router (${code ?? e?.message}).`,
        ),
      );
    });

    socket.once("close", () => {
      if (!settled) {
        fail(new Error("Koneksi ke port API router terputus."));
      }
    });

    const sendNext = () => {
      if (current || queue.length === 0 || !loggedIn) return;
      const next = queue.shift();
      if (!next) return;
      current = next;

      current.timer = setTimeout(() => {
        if (current === next) {
          const timeoutErr = new Error(
            `Perintah API '${next.path}' timeout setelah ${timeoutMs}ms.`,
          );
          current = null;
          next.reject(timeoutErr);
          sendNext();
        }
      }, timeoutMs);

      const words = [current.path, ...current.params, `.tag=${current.tag}`];
      socket.write(encodeSentence(words));
    };

    const startLogin = () => {
      const password = router.apiPassword ?? "";
      const words = [
        "/login",
        `=name=${router.apiUsername}`,
        `=password=${password}`,
      ];
      socket.write(encodeSentence(words));
    };

    const api: MikrotikConn = {
      write(path, params = []) {
        return new Promise((res, rej) => {
          if (settled) {
            return rej(new Error("Koneksi API router sudah ditutup."));
          }
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
        if (failTimer) clearTimeout(failTimer);
        if (connectTimer) clearTimeout(connectTimer);
        if (current?.timer) clearTimeout(current.timer);
        socket.destroy();
      },
    };

    const processData = () => {
      const { packets, consumed } = parsePackets(buffer);
      if (consumed === 0) return;
      buffer = buffer.subarray(consumed);

      for (const p of packets) {
        const first = p[0] ?? "";
        if (first === "!done") {
          if (!loggedIn) {
            // Cek apakah router lama (<6.43) meminta MD5 challenge response
            const retLine = p.find((l) => l.startsWith("=ret="));
            if (retLine && !loginChallengeRet) {
              loginChallengeRet = retLine.slice(5);
              const md5 = crypto.createHash("md5");
              md5.update(Buffer.from([0]));
              md5.update(Buffer.from(router.apiPassword ?? ""));
              md5.update(Buffer.from(loginChallengeRet, "hex"));
              const response = `00${md5.digest("hex")}`;
              const words = [
                "/login",
                `=name=${router.apiUsername}`,
                `=response=${response}`,
              ];
              socket.write(encodeSentence(words));
              continue;
            }

            // Login berhasil
            loggedIn = true;
            if (failTimer) {
              clearTimeout(failTimer);
            }
            resolve(api);
            sendNext();
          } else if (current) {
            if (current.timer) clearTimeout(current.timer);
            current.resolve(pendingRows.splice(0));
            current = null;
            sendNext();
          }
        } else if (first === "!trap" || first === "!fatal") {
          const msg =
            p.find((l) => l.startsWith("=message="))?.slice(9) ??
            (first === "!trap"
              ? "Autentikasi gagal (username atau password salah)."
              : first);

          if (!loggedIn) {
            fail(new Error(msg));
            return;
          }

          if (current) {
            if (current.timer) clearTimeout(current.timer);
            current.reject(new Error(msg));
            current = null;
            sendNext();
          }
        } else if (first === "!re" || first.startsWith("=")) {
          pendingRows.push(rowToObject(p));
        }
      }
    };

    socket.on("data", (d) => {
      buffer = Buffer.concat([buffer, d]);
      processData();
    });

    socket.on("connect", () => {
      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
      failTimer = setTimeout(
        () => fail(new Error("Timeout autentikasi login API RouterOS.")),
        timeoutMs,
      );
      startLogin();
    });
  });
}

/** Pesan error ramah-manusia untuk kegagalan RouterOS API. */
export function messageRouterosError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes("refused") || lower.includes("ditolak")) {
    return "Tidak dapat terhubung ke port API router (koneksi ditolak). Pastikan service /ip service api aktif.";
  }
  if (
    lower.includes("password") ||
    lower.includes("user") ||
    lower.includes("autentikasi") ||
    lower.includes("cannot log in")
  ) {
    return "Autentikasi API RouterOS gagal (username atau password salah).";
  }
  if (lower.includes("timeout")) {
    return "Koneksi ke port API router timeout (tidak merespons).";
  }
  return `Gagal berkomunikasi dengan API router: ${raw}`;
}
