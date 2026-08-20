import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  getMonthlyUsageFromSessions,
  getUsageHistoryFromSessions,
} from "@/lib/usage-real";

type Params = Promise<{ id: string }>;

/**
 * Data usage pelanggan: riwayat harian (30 hari default, atau bulan tertentu
 * via ?year=&month=) + bulanan 12 bulan (filter ?year=). Diagregasi dari
 * radacct — akun baru tanpa sesi menghasilkan array kosong.
 */
export const GET = asyncApi(async (req: Request, ctx: { params: Params }) => {
  await requirePermission("customer.read");
  const { id } = await ctx.params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new Error("Pelanggan tidak ditemukan.");

  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;
  const monthParam = url.searchParams.get("month");
  const month = monthParam ? Number(monthParam) : undefined;

  const [history, monthly] = await Promise.all([
    getUsageHistoryFromSessions(
      prisma,
      id,
      30,
      new Date(),
      year ? { year, month } : undefined,
    ),
    getMonthlyUsageFromSessions(prisma, id, year),
  ]);

  return NextResponse.json({ data: { history, monthly } });
});
