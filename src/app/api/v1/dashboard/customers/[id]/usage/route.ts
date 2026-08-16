import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  getCustomerMonthlyUsage,
  getCustomerUsageHistory,
} from "@/lib/usage-synthetic";

type Params = Promise<{ id: string }>;

/**
 * Data usage pelanggan: riwayat 30 hari + bulanan 12 bulan (filter ?year=).
 * Deterministik dari mock (usage-synthetic.ts).
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
    getCustomerUsageHistory(id),
    getCustomerMonthlyUsage(id, year),
  ]);

  return NextResponse.json({ data: { history, monthly } });
});
