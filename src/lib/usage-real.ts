/**
 * Agregasi data usage DARI SESI NYATA (tabel session / radacct).
 *
 * Menggantikan data synthetic (usage-synthetic.ts) untuk:
 * - Detail pelanggan (30 hari + bulanan)
 * - Portal pelanggan (usage history)
 *
 * Akun baru tanpa sesi → hasil array kosong (grafik kosong), bukan angka
 * synthetic yang menyesatkan.
 */
import type { PrismaClient } from "@/generated/prisma";
import type { CustomerDailyUsage, CustomerMonthlyUsage } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function labelId(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Riwayat pemakaian harian N hari terakhir (termasuk hari tanpa sesi → 0). */
export async function getUsageHistoryFromSessions(
  prisma: PrismaClient,
  customerId: string,
  days = 30,
  now = new Date(),
): Promise<CustomerDailyUsage[]> {
  const since = new Date(now.getTime() - (days - 1) * DAY_MS);
  since.setHours(0, 0, 0, 0);

  const sessions = await prisma.session.findMany({
    where: { customerId, startedAt: { gte: since } },
    select: {
      startedAt: true,
      inputBytes: true,
      outputBytes: true,
      durationSeconds: true,
    },
  });

  const byDay = new Map<string, CustomerDailyUsage>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    byDay.set(labelId(d), {
      date: d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      }),
      downloadBytes: 0,
      uploadBytes: 0,
      totalBytes: 0,
      sessionsCount: 0,
    });
  }

  for (const s of sessions) {
    const key = labelId(s.startedAt);
    if (!byDay.has(key)) continue;
    const day = byDay.get(key)!;
    day.downloadBytes += Number(s.inputBytes);
    day.uploadBytes += Number(s.outputBytes);
    day.totalBytes += Number(s.inputBytes) + Number(s.outputBytes);
    day.sessionsCount += 1;
  }

  return Array.from(byDay.values());
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
  const start = new Date(startYear, startMonth, 1);

  const sessions = await prisma.session.findMany({
    where: { customerId, startedAt: { gte: start } },
    select: {
      startedAt: true,
      inputBytes: true,
      outputBytes: true,
      durationSeconds: true,
    },
  });

  const months = new Map<string, CustomerMonthlyUsage>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(startYear, startMonth + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.set(key, {
      month: key,
      label: d.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
      downloadBytes: 0,
      uploadBytes: 0,
      totalBytes: 0,
      sessionsCount: 0,
    });
  }

  for (const s of sessions) {
    const key = `${s.startedAt.getFullYear()}-${String(s.startedAt.getMonth() + 1).padStart(2, "0")}`;
    const m = months.get(key);
    if (!m) continue;
    m.downloadBytes += Number(s.inputBytes);
    m.uploadBytes += Number(s.outputBytes);
    m.totalBytes += Number(s.inputBytes) + Number(s.outputBytes);
    m.sessionsCount += 1;
  }

  return Array.from(months.values());
}
