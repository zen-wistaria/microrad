import type { Session } from "../types";
import { relNowIso, relSecondsBetween } from "./relative-dates";

export const initialSessions: Session[] = [
  // --- Active Sessions (stoppedAt is undefined) ---
  // Semua "startedAt" dihitung relatif terhadap SEKARANG, sehingga selalu
  // tampil "live" dan tidak pernah melampaui tanggal sekarang.
  {
    id: "sess-101",
    customerId: "cust-1",
    customerUsername: "budi_santoso",
    nasId: "nas-1",
    nasIpAddress: "192.168.88.1",
    framedIp: "10.10.10.15",
    startedAt: relNowIso(0, 4, 18), // ~4h 18m lalu
    durationSeconds: 4 * 3600 + 18 * 60, // ~4h 18m
    inputBytes: 840 * 1024 * 1024, // 840 MB
    outputBytes: 4.85 * 1024 * 1024 * 1024, // 4.85 GB
  },
  {
    id: "sess-102",
    customerId: "cust-2",
    customerUsername: "siti_rahma",
    nasId: "nas-1",
    nasIpAddress: "192.168.88.1",
    framedIp: "10.10.10.16",
    startedAt: relNowIso(0, 8, 42), // ~8h 42m lalu
    durationSeconds: 8 * 3600 + 42 * 60, // ~8h 42m
    inputBytes: 1.45 * 1024 * 1024 * 1024, // 1.45 GB
    outputBytes: 12.6 * 1024 * 1024 * 1024, // 12.6 GB
  },
  {
    id: "sess-103",
    customerId: "cust-3",
    customerUsername: "anton_wijaya",
    nasId: "nas-1",
    nasIpAddress: "192.168.88.1",
    framedIp: "10.10.10.17",
    startedAt: relNowIso(0, 1, 15), // ~1h 15m lalu
    durationSeconds: 1 * 3600 + 15 * 60, // ~1h 15m
    inputBytes: 520 * 1024 * 1024, // 520 MB
    outputBytes: 6.2 * 1024 * 1024 * 1024, // 6.2 GB
  },
  {
    id: "sess-104",
    customerId: "cust-4",
    customerUsername: "reza_pratama",
    nasId: "nas-2",
    nasIpAddress: "192.168.10.1",
    framedIp: "10.10.20.21",
    startedAt: relNowIso(0, 2, 5), // ~2h 5m lalu
    durationSeconds: 2 * 3600 + 5 * 60,
    inputBytes: 310 * 1024 * 1024,
    outputBytes: 3.1 * 1024 * 1024 * 1024,
  },
  {
    id: "sess-105",
    customerId: "cust-5",
    customerUsername: "mega_puspita",
    nasId: "nas-2",
    nasIpAddress: "192.168.10.1",
    framedIp: "10.10.20.22",
    startedAt: relNowIso(0, 12, 30), // ~12h 30m lalu
    durationSeconds: 12 * 3600 + 30 * 60,
    inputBytes: 980 * 1024 * 1024,
    outputBytes: 8.4 * 1024 * 1024 * 1024,
  },
  {
    id: "sess-106",
    customerId: "cust-6",
    customerUsername: "dian_sastro",
    nasId: "nas-3",
    nasIpAddress: "192.168.20.1",
    framedIp: "10.10.30.10",
    startedAt: relNowIso(0, 3, 50), // ~3h 50m lalu
    durationSeconds: 3 * 3600 + 50 * 60,
    inputBytes: 650 * 1024 * 1024,
    outputBytes: 7.9 * 1024 * 1024 * 1024,
  },
  {
    id: "sess-107",
    customerId: "cust-7",
    customerUsername: "eko_prasetyo",
    nasId: "nas-1",
    nasIpAddress: "192.168.88.1",
    framedIp: "10.10.10.20",
    startedAt: relNowIso(0, 0, 25), // ~25 menit lalu
    durationSeconds: 25 * 60,
    inputBytes: 1.8 * 1024 * 1024 * 1024,
    outputBytes: 18.2 * 1024 * 1024 * 1024,
  },
  {
    id: "sess-108",
    customerId: "cust-8",
    customerUsername: "maya_lestari",
    nasId: "nas-1",
    nasIpAddress: "192.168.88.1",
    framedIp: "10.10.10.25",
    startedAt: relNowIso(0, 5, 10), // ~5h 10m lalu
    durationSeconds: 5 * 3600 + 10 * 60,
    inputBytes: 420 * 1024 * 1024,
    outputBytes: 4.1 * 1024 * 1024 * 1024,
  },

  // --- Historical Sessions (stoppedAt has value) ---
  {
    id: "sess-201",
    customerId: "cust-1",
    customerUsername: "budi_santoso",
    nasId: "nas-1",
    nasIpAddress: "192.168.88.1",
    framedIp: "10.10.10.15",
    startedAt: relNowIso(1, 17, 10), // kemarin, ~17 jam lalu
    stoppedAt: relNowIso(0, 0, 15), // ~15 menit lalu
    durationSeconds: relSecondsBetween(
      { daysAgo: 1, hoursAgo: 17, minutesAgo: 10 },
      { daysAgo: 0, minutesAgo: 15 },
    ),
    inputBytes: 1.1 * 1024 * 1024 * 1024,
    outputBytes: 9.8 * 1024 * 1024 * 1024,
    terminateCause: "User-Request",
  },
  {
    id: "sess-202",
    customerId: "cust-1",
    customerUsername: "budi_santoso",
    nasId: "nas-1",
    nasIpAddress: "192.168.88.1",
    framedIp: "10.10.10.15",
    startedAt: relNowIso(2, 16, 0), // 2 hari lalu
    stoppedAt: relNowIso(2, 1, 30),
    durationSeconds: relSecondsBetween(
      { daysAgo: 2, hoursAgo: 16 },
      { daysAgo: 2, hoursAgo: 1, minutesAgo: 30 },
    ),
    inputBytes: 950 * 1024 * 1024,
    outputBytes: 8.2 * 1024 * 1024 * 1024,
    terminateCause: "Idle-Timeout",
  },
  {
    id: "sess-203",
    customerId: "cust-2",
    customerUsername: "siti_rahma",
    nasId: "nas-1",
    nasIpAddress: "192.168.88.1",
    framedIp: "10.10.10.16",
    startedAt: relNowIso(1, 18, 0), // kemarin
    stoppedAt: relNowIso(1, 2, 0),
    durationSeconds: relSecondsBetween(
      { daysAgo: 1, hoursAgo: 18 },
      { daysAgo: 1, hoursAgo: 2 },
    ),
    inputBytes: 2.1 * 1024 * 1024 * 1024,
    outputBytes: 15.4 * 1024 * 1024 * 1024,
    terminateCause: "User-Request",
  },
  {
    id: "sess-204",
    customerId: "cust-3",
    customerUsername: "anton_wijaya",
    nasId: "nas-1",
    nasIpAddress: "192.168.88.1",
    framedIp: "10.10.10.17",
    startedAt: relNowIso(1, 10, 0), // kemarin siang
    stoppedAt: relNowIso(0, 22, 30),
    durationSeconds: relSecondsBetween(
      { daysAgo: 1, hoursAgo: 10 },
      { daysAgo: 0, hoursAgo: 22, minutesAgo: 30 },
    ),
    inputBytes: 1.6 * 1024 * 1024 * 1024,
    outputBytes: 14.8 * 1024 * 1024 * 1024,
    terminateCause: "Lost-Carrier",
  },
  {
    id: "sess-205",
    customerId: "cust-9",
    customerUsername: "hendra_gunawan",
    nasId: "nas-1",
    nasIpAddress: "192.168.88.1",
    framedIp: "10.10.10.30",
    startedAt: relNowIso(1, 16, 0), // kemarin
    stoppedAt: relNowIso(0, 14, 45),
    durationSeconds: relSecondsBetween(
      { daysAgo: 1, hoursAgo: 16 },
      { daysAgo: 0, hoursAgo: 14, minutesAgo: 45 },
    ),
    inputBytes: 1.8 * 1024 * 1024 * 1024,
    outputBytes: 11.5 * 1024 * 1024 * 1024,
    terminateCause: "Admin-Reset",
  },
  {
    id: "sess-206",
    customerId: "cust-10",
    customerUsername: "fajar_nugraha",
    nasId: "nas-2",
    nasIpAddress: "192.168.10.1",
    framedIp: "10.10.20.35",
    startedAt: relNowIso(2, 14, 0), // 2 hari lalu
    stoppedAt: relNowIso(1, 0, 10),
    durationSeconds: relSecondsBetween(
      { daysAgo: 2, hoursAgo: 14 },
      { daysAgo: 1, minutesAgo: 10 },
    ),
    inputBytes: 3.4 * 1024 * 1024 * 1024,
    outputBytes: 28.6 * 1024 * 1024 * 1024,
    terminateCause: "User-Request",
  },
  {
    id: "sess-207",
    customerId: "cust-14",
    customerUsername: "bambang_p",
    nasId: "nas-1",
    nasIpAddress: "192.168.88.1",
    framedIp: "10.10.10.55",
    startedAt: relNowIso(1, 6, 0), // kemarin pagi
    stoppedAt: relNowIso(0, 17, 40),
    durationSeconds: relSecondsBetween(
      { daysAgo: 1, hoursAgo: 6 },
      { daysAgo: 0, hoursAgo: 17, minutesAgo: 40 },
    ),
    inputBytes: 890 * 1024 * 1024,
    outputBytes: 7.2 * 1024 * 1024 * 1024,
    terminateCause: "Lost-Carrier",
  },
  {
    id: "sess-208",
    customerId: "cust-15",
    customerUsername: "kevin_sanjaya",
    nasId: "nas-1",
    nasIpAddress: "192.168.88.1",
    framedIp: "10.10.10.60",
    startedAt: relNowIso(1, 4, 0), // kemarin malam
    stoppedAt: relNowIso(0, 12, 20),
    durationSeconds: relSecondsBetween(
      { daysAgo: 1, hoursAgo: 4 },
      { daysAgo: 0, hoursAgo: 12, minutesAgo: 20 },
    ),
    inputBytes: 2.2 * 1024 * 1024 * 1024,
    outputBytes: 19.1 * 1024 * 1024 * 1024,
    terminateCause: "User-Request",
  },
];
