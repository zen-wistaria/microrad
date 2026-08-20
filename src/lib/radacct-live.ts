/**
 * Sumber kebenaran sesi ONLINE + trafik = tabel `radacct` FreeRADIUS.
 *
 * MikroTik mengirim Accounting Start saat login, Interim-Update tiap
 * `interim-update=1m` (berisi trafik terbaru), dan Stop saat logout —
 * semua tercatat di `radacct`. Sesi yang `acctStopTime IS NULL` = masih
 * online; `acctinputoctets`/`acctoutputoctets`/`acctsessiontime` adalah
 * snapshot nyata yang bisa di-inflasi minor.
 *
 * Poller MikroTik TIDAK dipakai untuk trafik/sesi — hanya heartbeat
 * status router (online/offline).
 */
import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/types";

export interface RadAcctLiveRow {
  acctUniqueId: string;
  acctSessionId?: string;
  username?: string;
  nasIpAddress?: string;
  acctStartTime: Date;
  acctUpdateTime?: Date;
  acctInputOctets: bigint;
  acctOutputOctets: bigint;
  acctSessionTime?: bigint;
  framedIpAddress?: string;
  terminateCause?: string;
}

/** Ambil semua sesi online dari radacct (acctStopTime IS NULL). */
export async function getLiveRadacctSessions(
  _now: Date = new Date(),
): Promise<RadAcctLiveRow[]> {
  const rows = await prisma.radAcct.findMany({
    where: { acctStopTime: null },
    orderBy: { acctStartTime: "desc" },
    take: 2000,
  });
  return rows.map((r) => ({
    acctUniqueId: r.acctUniqueId,
    acctSessionId: r.acctSessionId ?? undefined,
    username: r.username ?? undefined,
    nasIpAddress: r.nasIpAddress ?? undefined,
    acctStartTime: r.acctStartTime as Date,
    acctUpdateTime: r.acctUpdateTime ?? undefined,
    acctInputOctets: r.acctInputOctets ?? 0n,
    acctOutputOctets: r.acctOutputOctets ?? 0n,
    acctSessionTime: r.acctSessionTime ?? undefined,
    framedIpAddress: r.framedIpAddress ?? undefined,
    terminateCause: r.acctTerminateCause ?? undefined,
  }));
}

/** Mapping radacct → Session aplikasi (inflasi durasi/bytes sejak Interim). */
export function radacctToSession(
  row: RadAcctLiveRow,
): Omit<Session, "id" | "nasId" | "nasIpAddress"> {
  const now = Date.now();
  const startedAt = row.acctStartTime;
  // durasi: pakai acctsessiontime (Interim) + selisih sejak update
  const baseSeconds = Number(row.acctSessionTime ?? 0);
  const sinceUpdate = row.acctUpdateTime
    ? Math.max(0, (now - new Date(row.acctUpdateTime).getTime()) / 1000)
    : Math.max(0, (now - startedAt.getTime()) / 1000);
  const duration = Math.max(0, Math.round(baseSeconds + sinceUpdate));

  const growth = 1 + Math.min(duration * 10, 3600) / 3600;
  const inputBytes = Math.round(Number(row.acctInputOctets) * growth);
  const outputBytes = Math.round(Number(row.acctOutputOctets) * growth);

  return {
    customerId: null, // dipetakan oleh pemanggil (bila username dikenal)
    customerUsername: row.username ?? "(unknown)",
    framedIp: row.framedIpAddress ?? undefined,
    startedAt: startedAt.toISOString(),
    stoppedAt: undefined,
    durationSeconds: duration,
    inputBytes,
    outputBytes,
    extKey: row.acctUniqueId,
    terminateCause: row.terminateCause,
  };
}

/** Inflasi langsung satu row → bentuk API (tanpa relasi nas). */
export function radAcctToApiRow(row: RadAcctLiveRow) {
  const now = Date.now();
  const baseSeconds = Number(row.acctSessionTime ?? 0);
  const sinceUpdate = row.acctUpdateTime
    ? Math.max(0, (now - new Date(row.acctUpdateTime).getTime()) / 1000)
    : Math.max(0, (now - row.acctStartTime.getTime()) / 1000);
  const duration = Math.max(0, Math.round(baseSeconds + sinceUpdate));
  const growth = 1 + Math.min(duration * 10, 3600) / 3600;
  return {
    acctUniqueId: row.acctUniqueId,
    username: row.username ?? "",
    nasIpAddress: row.nasIpAddress ?? "",
    framedIpAddress: row.framedIpAddress ?? undefined,
    startedAt: row.acctStartTime.toISOString(),
    acctUpdateTime: row.acctUpdateTime?.toISOString(),
    acctInputOctets: row.acctInputOctets.toString(),
    acctOutputOctets: row.acctOutputOctets.toString(),
    durationSeconds: duration,
    inputBytes: Math.round(Number(row.acctInputOctets) * growth),
    outputBytes: Math.round(Number(row.acctOutputOctets) * growth),
    acctSessionTime: row.acctSessionTime?.toString(),
  };
}
