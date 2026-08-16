import type { AppUser } from "../types";
import { relNowIso } from "./relative-dates";

/**
 * Log login global sistem (mock, deterministik).
 *
 * Mencatat aktivitas login semua pengguna aplikasi: waktu, alamat IP,
 * user agent, nama user yang login, dan sumber (portal / aplikasi / api).
 *
 * Timestamp dihitung relatif terhadap SEKARANG sehingga tidak pernah
 * melampaui tanggal hari ini.
 */

export interface GlobalLogEntry {
  id: string;
  /** Waktu kejadian */
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  /** Nama user yang login (bukan username) */
  userName: string;
  /** Sumber login: "portal" | "app" | "api" */
  source: "portal" | "app" | "api";
}

const IP_POOL = [
  "36.84.12.201",
  "36.84.12.157",
  "114.125.45.88",
  "114.125.46.23",
  "103.119.48.140",
  "182.253.101.66",
  "36.90.201.44",
  "114.125.47.19",
];

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14; SM-A156E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0",
  "Mozilla/5.0 (Linux; Android 13; Redmi Note 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36",
];

// Sumber login: hanya 2 label yang dipakai UI (Aplikasi / Portal Langganan);
// "api" dicadangkan utk akses sistem di masa depan.
const SOURCES: GlobalLogEntry["source"][] = ["portal", "app"];

function hashOf(id: string): number {
  return id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

/** Log login global — 60 entri, dari ~2 jam lalu s.d. ~45 hari lalu */
export function getGlobalLogs(users: AppUser[]): GlobalLogEntry[] {
  const logs: GlobalLogEntry[] = [];
  const activeUsers = users.filter((u) => u.status === "active");

  for (let i = 0; i < 60; i++) {
    // Pilih user secara deterministik dari daftar user aktif
    const user = activeUsers[i % activeUsers.length] ?? activeUsers[0];
    const h = hashOf(user.id);

    // Sebaran: makin baru makin sering
    const daysAgo = Math.floor(i / 6); // 0–9 hari untuk 60 entri
    const hoursAgo = daysAgo === 0 ? (h + i * 3) % 20 : (h + i) % 24;
    const minutesAgo = (h + i * 17) % 60;

    logs.push({
      id: `log-global-${i}`,
      timestamp: relNowIso(daysAgo, hoursAgo, minutesAgo),
      ipAddress: IP_POOL[(h + i * 7) % IP_POOL.length],
      userAgent: USER_AGENTS[(h + i * 13) % USER_AGENTS.length],
      userName: user.name,
      source: SOURCES[(h + i * 5) % SOURCES.length],
    });
  }

  return logs.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
