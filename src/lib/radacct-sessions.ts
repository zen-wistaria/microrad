/**
 * Sesi ONLINE = tabel radacct FreeRADIUS (sumber kebenaran UI).
 *
 * Berbeda dari `radacct-live.ts` (helper low-level), file ini memetakan
 * radacct langsung ke bentuk Session aplikasi — dipakai GET /sessions,
 * dashboard onlineNow, dan detail pelanggan. Disconnect di router →
 * FreeRADIUS menerima Accounting-Stop → sesi hilang dari query dalam
 * ≤ interval polling UI. Tidak bergantung pada poller MikroTik.
 */
import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/types";

export interface RadacctSessionRow {
  acctUniqueId: string;
  username: string | null;
  nasIpAddress: string | null;
  framedIpAddress: string | null;
  acctStartTime: Date | null;
  acctUpdateTime: Date | null;
  acctStopTime: Date | null;
  acctSessionTime: bigint | null;
  acctInputOctets: bigint | null;
  acctOutputOctets: bigint | null;
  acctTerminateCause: string | null;
}

/** Query sesi online (acctStopTime IS NULL) dari radacct. */
export async function getOnlineRadacct(
  opts: { nasIpAddress?: string; username?: string; limit?: number } = {},
): Promise<RadacctSessionRow[]> {
  const where: Record<string, unknown> = { acctStopTime: null };
  if (opts.nasIpAddress) where.nasIpAddress = opts.nasIpAddress;
  if (opts.username) where.username = opts.username;
  const rows = await prisma.radAcct.findMany({
    where,
    orderBy: { acctStartTime: "desc" },
    take: opts.limit ?? 1000,
    select: {
      acctUniqueId: true,
      username: true,
      nasIpAddress: true,
      framedIpAddress: true,
      acctStartTime: true,
      acctUpdateTime: true,
      acctStopTime: true,
      acctSessionTime: true,
      acctInputOctets: true,
      acctOutputOctets: true,
      acctTerminateCause: true,
    },
  });
  return rows;
}

/** Petakan row radacct → bentuk Session aplikasi (inflasi sejak Interim). */
export function radacctRowToSession(
  row: RadacctSessionRow,
): Omit<Session, "id" | "nasId"> & { id: string; nasId: string } {
  const nowMs = Date.now();
  const started = row.acctStartTime ?? new Date();
  const baseMs = Number(row.acctSessionTime ?? 0) * 1000;
  const sinceUpdateMs = row.acctUpdateTime
    ? Math.max(0, nowMs - new Date(row.acctUpdateTime).getTime())
    : Math.max(0, nowMs - started.getTime());
  const duration = Math.max(0, Math.round((baseMs + sinceUpdateMs) / 1000));
  const growth = 1 + Math.min(duration * 10, 3600) / 3600;

  return {
    id: `acct-${row.acctUniqueId}`,
    customerId: null, // pemanggil isi bila username dikenal
    customerUsername: row.username ?? "(unknown)",
    nasId: "", // pemanggil isi bila perlu
    nasIpAddress: row.nasIpAddress ?? "",
    framedIp: row.framedIpAddress ?? undefined,
    startedAt: started.toISOString(),
    stoppedAt: undefined,
    durationSeconds: duration,
    inputBytes: Math.round(Number(row.acctInputOctets ?? 0) * growth),
    outputBytes: Math.round(Number(row.acctOutputOctets ?? 0) * growth),
    extKey: row.acctUniqueId,
    terminateCause: row.acctTerminateCause ?? undefined,
    /** Waktu terakhir basis durasi (Interim) — dipakai counter live */
    acctUpdateTime: row.acctUpdateTime?.toISOString(),
  };
}

/** Query HISTORY sesi (semua baris radacct — online + selesai). */
export async function getRadacctHistory(
  opts: {
    username?: string;
    nasIpAddress?: string;
    since?: Date;
    until?: Date;
    limit?: number;
  } = {},
): Promise<RadacctSessionRow[]> {
  const where: Record<string, unknown> = {};
  if (opts.username) where.username = opts.username;
  if (opts.nasIpAddress) where.nasIpAddress = opts.nasIpAddress;
  if (opts.since || opts.until) {
    where.acctStartTime = {
      ...(opts.since ? { gte: opts.since } : {}),
      ...(opts.until ? { lt: opts.until } : {}),
    };
  }
  const rows = await prisma.radAcct.findMany({
    where,
    orderBy: { acctStartTime: "desc" },
    take: opts.limit ?? 2000,
    select: {
      acctUniqueId: true,
      username: true,
      nasIpAddress: true,
      framedIpAddress: true,
      acctStartTime: true,
      acctUpdateTime: true,
      acctStopTime: true,
      acctSessionTime: true,
      acctInputOctets: true,
      acctOutputOctets: true,
      acctTerminateCause: true,
    },
  });

  // Dedup per sesi: simpan baris dgn acctUpdateTime terakhir (Interim/Stop)
  const byUnique = new Map<string, RadacctSessionRow>();
  for (const r of rows) {
    const existing = byUnique.get(r.acctUniqueId);
    const curUpdated =
      r.acctUpdateTime?.getTime() ?? r.acctStartTime?.getTime() ?? 0;
    const oldUpdated =
      existing?.acctUpdateTime?.getTime() ??
      existing?.acctStartTime?.getTime() ??
      0;
    if (!existing || curUpdated > oldUpdated) byUnique.set(r.acctUniqueId, r);
  }
  return Array.from(byUnique.values()).sort(
    (a, b) =>
      (b.acctStartTime?.getTime() ?? 0) - (a.acctStartTime?.getTime() ?? 0),
  );
}

/** Petakan row history radacct → Session (stoppedAt terisi bila selesai). */
export function radacctHistoryRowToSession(
  row: RadacctSessionRow,
): Omit<Session, "id" | "nasId"> & { id: string; nasId: string } {
  const started = row.acctStartTime ?? new Date();
  const stopAt = row.acctStopTime;
  // Durasi: acctSessionTime (dari Interim/Stop); inflasi minor sejak update
  // hanya untuk sesi yang masih online.
  let duration = Number(row.acctSessionTime ?? 0);
  if (!stopAt) {
    const nowMs = Date.now();
    const sinceUpdateMs = row.acctUpdateTime
      ? Math.max(0, nowMs - new Date(row.acctUpdateTime).getTime())
      : Math.max(0, nowMs - started.getTime());
    duration = Math.max(0, Math.round(duration + sinceUpdateMs / 1000));
  }
  const growth = stopAt ? 1 : 1 + Math.min(duration * 10, 3600) / 3600;

  return {
    id: `acct-${row.acctUniqueId}`,
    customerId: null, // pemanggil isi bila username dikenal
    customerUsername: row.username ?? "(unknown)",
    nasId: "",
    nasIpAddress: row.nasIpAddress ?? "",
    framedIp: row.framedIpAddress ?? undefined,
    startedAt: started.toISOString(),
    stoppedAt: stopAt ? stopAt.toISOString() : undefined,
    durationSeconds: Math.max(0, Math.round(duration)),
    inputBytes: Math.round(Number(row.acctInputOctets ?? 0) * growth),
    outputBytes: Math.round(Number(row.acctOutputOctets ?? 0) * growth),
    extKey: row.acctUniqueId,
    terminateCause: row.acctTerminateCause ?? undefined,
  };
}
