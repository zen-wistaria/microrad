import { exec } from "node:child_process";
import net from "node:net";
import os from "node:os";

export interface PingResult {
  alive: boolean;
  latencyMs: number;
  method: "icmp" | "tcp";
  error?: string;
}

/**
 * Ping ICMP ke IP target secara cross-platform (Windows / Linux / macOS).
 */
export function pingIcmp(
  host: string,
  timeoutMs = 2000,
): Promise<{ alive: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    const isWin = os.platform() === "win32";
    const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000));
    const cmd = isWin
      ? `ping -n 1 -w ${timeoutMs} ${host}`
      : `ping -c 1 -W ${timeoutSec} ${host}`;

    const start = Date.now();
    exec(cmd, { timeout: timeoutMs + 1000 }, (err, stdout) => {
      const duration = Date.now() - start;
      if (err && !stdout) {
        return resolve({ alive: false, latencyMs: duration });
      }

      const out = stdout ? stdout.toString() : "";
      if (isWin) {
        // Pada Windows, cek adanya TTL= dan tidak ada pesan error / unreachable / timeout
        const isError =
          out.includes("Destination net unreachable") ||
          out.includes("Destination host unreachable") ||
          out.includes("Request timed out") ||
          out.includes("could not find host") ||
          out.includes("General failure") ||
          out.includes("100% loss");

        if (isError || !out.includes("TTL=")) {
          return resolve({ alive: false, latencyMs: duration });
        }

        const match = out.match(/time[=<]([0-9]+)\s*ms/i);
        const lat = match ? Number(match[1]) : duration;
        return resolve({ alive: true, latencyMs: Math.max(0, lat) });
      } else {
        // Linux / macOS
        if (
          err ||
          out.includes("0 received") ||
          out.includes("100% packet loss")
        ) {
          return resolve({ alive: false, latencyMs: duration });
        }
        const match = out.match(/time=([0-9.]+)\s*ms/i);
        const lat = match ? Math.round(Number(match[1])) : duration;
        return resolve({ alive: true, latencyMs: Math.max(0, lat) });
      }
    });
  });
}

/**
 * Fallback TCP probe ke port (default 8728 API, 8291 Winbox, 80 Webfig).
 * Jika host merespons dengan connect atau ECONNREFUSED/ECONNRESET, berarti host AKTIF.
 */
export function pingTcp(
  host: string,
  port = 8728,
  timeoutMs = 2000,
): Promise<{ alive: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;

    const finish = (alive: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      const latencyMs = Date.now() - start;
      resolve({ alive, latencyMs });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", (err: NodeJS.ErrnoException) => {
      // Jika port menolak (ECONNREFUSED/ECONNRESET), host-nya AKTIF di IP tersebut
      if (err.code === "ECONNREFUSED" || err.code === "ECONNRESET") {
        finish(true);
      } else {
        finish(false);
      }
    });

    try {
      socket.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

/**
 * Ping router gabungan (ICMP utama + TCP fallback).
 * Menghasilkan status online/offline tanpa membutuhkan kredensial login.
 */
export async function pingRouterHost(
  host: string,
  port = 8728,
  timeoutMs = 2000,
): Promise<PingResult> {
  // 1. Coba ICMP ping standar
  const icmp = await pingIcmp(host, timeoutMs);
  if (icmp.alive) {
    return { alive: true, latencyMs: icmp.latencyMs, method: "icmp" };
  }

  // 2. Fallback TCP probe ke port API / port router jika ICMP diblokir firewall
  const targetPort = port > 0 ? port : 8728;
  const tcp = await pingTcp(host, targetPort, timeoutMs);
  if (tcp.alive) {
    return { alive: true, latencyMs: tcp.latencyMs, method: "tcp" };
  }

  return {
    alive: false,
    latencyMs: icmp.latencyMs || timeoutMs,
    method: "icmp",
    error: "Host tidak merespons ping ICMP maupun koneksi TCP",
  };
}
