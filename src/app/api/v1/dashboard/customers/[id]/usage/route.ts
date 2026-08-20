import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  getMonthlyUsageFromSessions,
  getUsageHistoryFromSessions,
} from "@/lib/usage-real";

type Params = Promise<{ id: string }>;

/**
 * Data usage pelanggan: riwayat 30 hari + bulanan 12 bulan (filter ?year=).
 * Diagregasi dari sesi nyata (tabel session) — akun baru tanpa sesi
 * menghasilkan array kosong, bukan data synthetic.
 */
export const GET = asyncApi(async (req: Request, ctx: { params: Params }) => {
  await requirePermission("customer.read");
  const { id } = await ctx.params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new Error("Pelanggan tidak ditemukan.");

  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam ? Number(yearParam) : undefined;

  const [history, monthly] = await Promise.all([
    getUsageHistoryFromSessions(prisma, id),
    getMonthlyUsageFromSessions(prisma, id, year),
  ]);

  return NextResponse.json({ data: { history, monthly } });
});
