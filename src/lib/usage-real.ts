/**
 * Agregasi data usage DARI RADIUS — tabel radacct (sumber kebenaran).
 *
 * Digunakan: detail pelanggan (30 hari + bulanan), portal, dashboard trend.
 *
 * FreeRADIUS/PostgreSQL menyimpan timestamptz (UTC). Untuk agregasi harian
 * & bulanan kita pakai offset zona waktu server (WIB, +07) agar hari kalender
 * konsisten. Baris tanpa acctStartTime dilewati.
 */
import type { PrismaClient } from "@/generated/prisma";
import type {
  CustomerDailyUsage,
  CustomerMonthlyUsage,
  UsageTrendPoint,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Key hari UTC ("YYYY-MM-DD") — FreeRADIUS mencatat UTC, agregasi ikut UTC. */
function dateKeyUTC(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** Key bulan UTC ("YYYY-MM") — sama prinsipnya. */
function monthKeyUTC(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Label tanggal lokal (WIB) dari Date UTC — hanya untuk tampilan. */
function localDateLabel(date: Date): string {
  const offsetMin = -date.getTimezoneOffset();
  const shifted = new Date(date.getTime() + offsetMin * 60_000);
  return shifted.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function localMonthLabel(date: Date): string {
  const offsetMin = -date.getTimezoneOffset();
  const shifted = new Date(date.getTime() + offsetMin * 60_000);
  return shifted.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Ambil sesi radacct (Start/Stop/interim) utk username sejak waktu UTC. */
async function getRadacctSessionsFor(
  prisma: PrismaClient,
  username: string,
  since: Date,
  until?: Date,
): Promise<
  Array<{
    acctUniqueId: string;
    acctStartTime: Date;
    acctInputOctets: bigint | null;
    acctOutputOctets: bigint | null;
  }>
> {
  // Catatan: TIDAK memakai `until = now` bilamana `until` tidak diberikan —
  // FreeRADIUS mencatat acctStartTime UTC yang bisa maju dari jam server
  // (clock/NAS), menghapus sesi baru dari window. Batas atas dipakai hanya
  // bila eksplisit (filter bulan — dari awal bulan).
  const rows = await prisma.radAcct.findMany({
    where: {
      username,
      acctStartTime: {
        gte: since,
        ...(until ? { lte: until } : {}),
      },
    },
    select: {
      acctUniqueId: true,
      acctStartTime: true,
      acctUpdateTime: true,
      acctInputOctets: true,
      acctOutputOctets: true,
    },
  });

  // Dedup per sesi (Interim menambah banyak baris): pakai baris terakhir
  // (acctUpdateTime tertinggi) per acctUniqueId.
  type Row = {
    acctUniqueId: string;
    acctStartTime: Date;
    acctInputOctets: bigint | null;
    acctOutputOctets: bigint | null;
  };
  const byUnique = new Map<string, Row>();
  for (const r of rows) {
    if (r.acctStartTime === null) continue;
    const existing = byUnique.get(r.acctUniqueId);
    const cur = r.acctUpdateTime?.getTime() ?? r.acctStartTime.getTime();
    const old = existing?.acctStartTime?.getTime() ?? 0;
    if (!existing || cur > old) {
      byUnique.set(r.acctUniqueId, {
        acctUniqueId: r.acctUniqueId,
        acctStartTime: r.acctStartTime,
        acctInputOctets: r.acctInputOctets,
        acctOutputOctets: r.acctOutputOctets,
      });
    }
  }
  return Array.from(byUnique.values());
}

/** Agregasi harian dalam rentang tanggal (from ≤ day < until), UTC. */
async function getUsageHistoryInRange(
  prisma: PrismaClient,
  username: string,
  from: Date,
  until: Date | undefined,
  _now: Date,
  days?: number,
): Promise<CustomerDailyUsage[]> {
  const sessions = await getRadacctSessionsFor(prisma, username, from, until);

  // Bucket per UTC day: bila `until` tak ada → `days` bucket mulai `from`
  // (default 30 hari terakhir); bila ada → bucket di antara from..until.
  const byDay = new Map<string, CustomerDailyUsage>();
  const dayCount = until
    ? Math.max(1, Math.round((until.getTime() - from.getTime()) / DAY_MS))
    : Math.max(1, days ?? 30);
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(from.getTime() + i * DAY_MS);
    const key = dateKeyUTC(d);
    byDay.set(key, {
      date: localDateLabel(d),
      downloadBytes: 0,
      uploadBytes: 0,
      totalBytes: 0,
      sessionsCount: 0,
    });
  }

  for (const s of sessions) {
    const key = dateKeyUTC(s.acctStartTime);
    const day = byDay.get(key);
    if (!day) continue;
    day.downloadBytes += Number(s.acctOutputOctets ?? 0);
    day.uploadBytes += Number(s.acctInputOctets ?? 0);
    day.totalBytes +=
      Number(s.acctInputOctets ?? 0) + Number(s.acctOutputOctets ?? 0);
    day.sessionsCount += 1;
  }

  return Array.from(byDay.values());
}

/**
 * Riwayat pemakaian harian — N hari terakhir (default) ATAU rentang bulan
 * tertentu (bila `year`/`month` diberikan).
 */
export async function getUsageHistoryFromSessions(
  prisma: PrismaClient,
  customerId: string,
  days = 30,
  now = new Date(),
  range?: { year: number; month?: number },
): Promise<CustomerDailyUsage[]> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { username: true },
  });
  if (!customer) return [];

  if (range) {
    const year = range.year;
    const month = range.month ?? 0; // 0 = seluruh tahun
    const from = new Date(Date.UTC(year, month === 0 ? 0 : month - 1, 1));
    const until = new Date(Date.UTC(year, month === 0 ? 12 : month, 1));
    return getUsageHistoryInRange(prisma, customer.username, from, until, now);
  }

  const since = new Date(now.getTime() - (days - 1) * DAY_MS);
  since.setUTCHours(0, 0, 0, 0);
  // 30 hari terakhir: tanpa batas atas (hindari sesi UTC maju terbuang)
  return getUsageHistoryInRange(
    prisma,
    customer.username,
    since,
    undefined,
    now,
    days,
  );
}

/** Pemakaian bulanan (rekap per bulan). 12 bulan terakhir atau filter tahun. */
export async function getMonthlyUsageFromSessions(
  prisma: PrismaClient,
  customerId: string,
  year?: number,
  now = new Date(),
): Promise<CustomerMonthlyUsage[]> {
  const startMonth = year ? 0 : now.getMonth() - 11;
  const startYear = year ?? now.getFullYear();
  const start = new Date(Date.UTC(startYear, startMonth, 1));

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { username: true },
  });
  if (!customer) return [];

  const sessions = await getRadacctSessionsFor(
    prisma,
    customer.username,
    start,
  );

  const months = new Map<string, CustomerMonthlyUsage>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(startYear, startMonth + i, 1));
    const key = monthKeyUTC(d);
    months.set(key, {
      month: key,
      label: localMonthLabel(d),
      downloadBytes: 0,
      uploadBytes: 0,
      totalBytes: 0,
      sessionsCount: 0,
    });
  }

  for (const s of sessions) {
    const key = monthKeyUTC(s.acctStartTime);
    const m = months.get(key);
    if (!m) continue;
    m.downloadBytes += Number(s.acctOutputOctets ?? 0);
    m.uploadBytes += Number(s.acctInputOctets ?? 0);
    m.totalBytes +=
      Number(s.acctInputOctets ?? 0) + Number(s.acctOutputOctets ?? 0);
    m.sessionsCount += 1;
  }

  return Array.from(months.values());
}

/** Tren penggunaan 7 hari terakhir di dashboard — agregasi nyata radacct. */
export async function getUsageTrendFromRadacct(
  prisma: PrismaClient,
  days = 7,
  now = new Date(),
): Promise<UsageTrendPoint[]> {
  const since = new Date(now.getTime() - (days - 1) * DAY_MS);
  since.setUTCHours(0, 0, 0, 0);

  const rows = await prisma.radAcct.findMany({
    where: { acctStartTime: { gte: since } },
    select: {
      acctStartTime: true,
      acctInputOctets: true,
      acctOutputOctets: true,
    },
  });

  const byDay = new Map<string, { download: number; upload: number }>();
  const points: UsageTrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    const key = dateKeyUTC(d);
    byDay.set(key, { download: 0, upload: 0 });
    points.push({
      date: localDateLabel(d),
      downloadBytes: 0,
      uploadBytes: 0,
      bytes: 0,
    });
  }

  for (const r of rows) {
    if (!r.acctStartTime) continue;
    const key = dateKeyUTC(r.acctStartTime);
    const day = byDay.get(key);
    if (!day) continue;
    day.download += Number(r.acctOutputOctets ?? 0);
    day.upload += Number(r.acctInputOctets ?? 0);
  }

  return points.map((p, i) => {
    const d = new Date(now.getTime() - (days - 1 - i) * DAY_MS);
    const key = dateKeyUTC(d);
    const day = byDay.get(key) ?? { download: 0, upload: 0 };
    return {
      ...p,
      downloadBytes: day.download,
      uploadBytes: day.upload,
      bytes: day.download + day.upload,
    };
  });
}
