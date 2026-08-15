import type { Customer } from "../types";
import { relNowIso } from "./relative-dates";

/**
 * Log portal pelanggan (mock, ditentukan secara deterministik per pelanggan).
 *
 * Berisi dua jenis log:
 * 1. LogLoginPortal — catatan login ke sistem portal: IP, user agent, waktu.
 * 2. LogSesiPppoe  — catatan sesi PPPoE (online/offline): kapan mulai, kapan
 *    berhenti, alasan berhenti.
 *
 * Semua timestamp dihitung relatif terhadap SEKARANG sehingga tidak pernah
 * melampaui tanggal hari ini.
 */

export interface LogLoginPortal {
  id: string;
  customerId: string;
  customerUsername: string;
  /** Waktu login (relatif ke sekarang) */
  loginAt: string;
  ipAddress: string;
  userAgent: string;
  /** "portal" | "admin" — dari mana login dilakukan */
  source?: string;
}

export interface LogSesiPppoe {
  id: string;
  customerId: string;
  customerUsername: string;
  startedAt: string;
  stoppedAt?: string; // undefined = masih online
  durationSeconds: number;
  inputBytes: number; // upload dari sisi customer
  outputBytes: number; // download dari sisi customer
  nasIpAddress: string;
  framedIp?: string;
  terminateCause?: string;
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

const TERMINATE_CAUSES = [
  "User-Request",
  "Idle-Timeout",
  "Lost-Carrier",
  "Admin-Reset",
  "Session-Timeout",
];

/** Hash deterministik per customerId */
function hashOf(id: string): number {
  return id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

/** Log login portal — 20 entri terakhir, 10 jam s.d. ~3 bulan lalu */
export function getPortalLoginLogs(customer: Customer): LogLoginPortal[] {
  const h = hashOf(customer.id);
  const logs: LogLoginPortal[] = [];

  for (let i = 0; i < 20; i++) {
    const seed = (h + i * 31) % 100;
    // Sebaran waktu: makin baru makin sering (beberapa per hari, dst.)
    const daysAgo = Math.floor((seed % 80) / 4); // 0–19 hari
    const hoursAgo = daysAgo === 0 ? (seed % 9) + 1 : seed % 24;
    const minutesAgo = seed % 60;
    const ip = IP_POOL[(h + i * 7) % IP_POOL.length];
    const ua = USER_AGENTS[(h + i * 13) % USER_AGENTS.length];
    const source = i % 4 === 0 ? "admin" : "portal";

    logs.push({
      id: `log-login-${customer.id}-${i}`,
      customerId: customer.id,
      customerUsername: customer.username,
      loginAt: relNowIso(daysAgo, hoursAgo, minutesAgo),
      ipAddress: ip,
      userAgent: ua,
      source,
    });
  }

  // Urutkan dari terbaru
  return logs.sort(
    (a, b) => new Date(b.loginAt).getTime() - new Date(a.loginAt).getTime(),
  );
}

/** Log sesi PPPoE — dari histori sesi pelanggan + sesi aktif (online) */
export function getPortalSessionLogs(
  customer: Customer,
  sessions: {
    startedAt: string;
    stoppedAt?: string;
    nasIpAddress: string;
    framedIp?: string;
    inputBytes: number;
    outputBytes: number;
    terminateCause?: string;
  }[],
): LogSesiPppoe[] {
  const h = hashOf(customer.id);
  const logs: LogSesiPppoe[] = [];

  const durSec = (start: string, stop?: string) =>
    Math.max(
      1,
      Math.round(
        ((stop ? new Date(stop).getTime() : Date.now()) -
          new Date(start).getTime()) /
          1000,
      ),
    );

  // Sesi aktif (dari sesi PPPoE nyata yang sedang berjalan)
  const active = sessions.find((s) => !s.stoppedAt);
  if (active) {
    logs.push({
      id: `log-sess-${customer.id}-active`,
      customerId: customer.id,
      customerUsername: customer.username,
      startedAt: active.startedAt,
      durationSeconds: durSec(active.startedAt),
      inputBytes: active.inputBytes,
      outputBytes: active.outputBytes,
      nasIpAddress: active.nasIpAddress,
      framedIp: active.framedIp,
    });
  }

  // Riwayat sesi (mengikuti histori sesi yang sudah ada)
  for (const s of sessions.filter((x) => x.stoppedAt)) {
    logs.push({
      id: `log-sess-${customer.id}-${s.startedAt}`,
      customerId: customer.id,
      customerUsername: customer.username,
      startedAt: s.startedAt,
      stoppedAt: s.stoppedAt,
      durationSeconds: durSec(s.startedAt, s.stoppedAt),
      inputBytes: s.inputBytes,
      outputBytes: s.outputBytes,
      nasIpAddress: s.nasIpAddress,
      framedIp: s.framedIp,
      terminateCause: s.terminateCause,
    });
  }

  // Beberapa entri tambahan deterministik (14–30 hari lalu) supaya daftar
  // terlihat riwayat nyata
  for (let i = 0; i < 12; i++) {
    const seed = (h + i * 53) % 100;
    const daysAgo = 14 + (seed % 17); // 14–30 hari lalu
    const startHour = seed % 20;
    const durHours = 2 + ((seed * 3) % 14); // 2–15 jam
    const stopHour = startHour + durHours;
    const stopDay = stopHour >= 24 ? daysAgo - 1 : daysAgo;
    const cause = TERMINATE_CAUSES[(seed * 5) % TERMINATE_CAUSES.length];
    const startedAt = relNowIso(daysAgo, startHour, seed % 60);
    const stoppedAt = relNowIso(stopDay, stopHour % 24, (seed * 7) % 60);
    const downFactor = 0.4 + ((seed * 3) % 10) / 10; // ~0.4–1.3 GB

    logs.push({
      id: `log-sess-${customer.id}-gen-${i}`,
      customerId: customer.id,
      customerUsername: customer.username,
      startedAt,
      stoppedAt,
      durationSeconds: durSec(startedAt, stoppedAt),
      inputBytes: Math.round(downFactor * 0.2 * 1024 * 1024 * 1024), // upload ~200 MB × factor
      outputBytes: Math.round(downFactor * 1.2 * 1024 * 1024 * 1024), // download ~1.2 GB × factor
      nasIpAddress: IP_POOL[(h + i * 11) % IP_POOL.length],
      framedIp: `10.10.10.${(seed % 200) + 10}`,
      terminateCause: cause,
    });
  }

  // Urutkan dari terbaru
  return logs.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}
