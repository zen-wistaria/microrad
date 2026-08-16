/**
 * Generator data usage/trend DETERMINISTIK — port dari mock database
 * (src/lib/mock/db.ts) agar dashboard/grafik identik dengan versi mock.
 * Di backend asli, data ini nantinya bisa diganti agregasi sesi nyata.
 */

export interface UsageTrendPoint {
  date: string;
  downloadBytes: number;
  uploadBytes: number;
  bytes: number;
}

export interface CustomerDailyUsage {
  date: string;
  downloadBytes: number;
  uploadBytes: number;
  totalBytes: number;
  sessionsCount: number;
}

export interface CustomerMonthlyUsage {
  month: string;
  label: string;
  downloadBytes: number;
  uploadBytes: number;
  totalBytes: number;
  sessionsCount: number;
}

function hashOf(id: string): number {
  return id.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

function mapRangeSeed(i: number, hash: number, step: number, mod: number) {
  return (hash + i * step) % mod;
}

/**
 * 7 titik tren 7 hari terakhir (dipakai dashboard).
 * Formula identik dengan mock: base 55 GB down / 12 GB up + seed.
 */
export function getUsageTrend(now = new Date()): UsageTrendPoint[] {
  const points: UsageTrendPoint[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const seed = ((i + 1) * 17) % 10;
    const download = Math.round((55 + seed * 4.5) * 1024 ** 3);
    const upload = Math.round((12 + seed * 1.8) * 1024 ** 3);
    points.push({
      date: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      downloadBytes: download,
      uploadBytes: upload,
      bytes: download + upload,
    });
  }
  return points;
}

/**
 * 30 titik pemakaian harian pelanggan.
 * Formula identik dengan mock: daySeed dari hash customerId; hari ini
 * menerima liveBias hingga +50%.
 */
export function getCustomerUsageHistory(
  customerId: string,
  now = new Date(),
): CustomerDailyUsage[] {
  const h = hashOf(customerId);
  const todayMs = now.getTime();
  const liveBias = Math.min(1, ((todayMs / 1000) % 86400) / 86400);

  const points: CustomerDailyUsage[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (29 - i));
    const daySeed = mapRangeSeed(i, h, 13, 100);
    const factor = (daySeed / 100) * 0.8 + 0.6;
    const bias = i === 29 ? liveBias : 0;
    const down = Math.round(factor * 2.8 * 1024 ** 3 * (1 + bias * 0.5));
    const up = Math.round(factor * 0.45 * 1024 ** 3 * (1 + bias * 0.5));
    points.push({
      date: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
      downloadBytes: down,
      uploadBytes: up,
      totalBytes: down + up,
      sessionsCount: (daySeed % 3) + 1,
    });
  }
  return points;
}

/**
 * 12 bulan pemakaian pelanggan (filter tahun; tanpa tahun → 12 bulan
 * berjalan). Formula identik dengan mock.
 */
export function getCustomerMonthlyUsage(
  customerId: string,
  year?: number,
  now = new Date(),
): CustomerMonthlyUsage[] {
  const h = hashOf(customerId);
  const months: CustomerMonthlyUsage[] = [];

  const startMonth = year ? 0 : now.getMonth() - 11;
  const startYear = year ?? now.getFullYear();

  for (let i = 0; i < 12; i++) {
    const d = new Date(startYear, startMonth + i, 1);
    const monthSeed = mapRangeSeed(i, h, 97, 100);
    const factor = (monthSeed / 100) * 0.9 + 0.4;
    const isCurrent =
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    const monthBias = isCurrent ? now.getDate() / 30 : 0;
    const down = Math.round(factor * 50 * 1024 ** 3 * (0.6 + monthBias * 0.4));
    const up = Math.round(factor * 10 * 1024 ** 3 * (0.6 + monthBias * 0.4));
    months.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("id-ID", {
        month: "short",
        year: "numeric",
      }),
      downloadBytes: down,
      uploadBytes: up,
      totalBytes: down + up,
      sessionsCount: (monthSeed % 20) + 18,
    });
  }
  return months;
}
