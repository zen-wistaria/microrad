import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/** Ringkasan billing — revenue/pending/overdue periode berjalan + counts semua */
export const GET = asyncApi(async () => {
  await requirePermission("billing.read");
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const [
    paidCount,
    unpaidCount,
    overdueCount,
    totalInvoicesCount,
    revenueThisMonth,
    pendingThisMonth,
    overdueThisMonth,
  ] = await Promise.all([
    prisma.invoice.count({ where: { status: "paid" } }),
    prisma.invoice.count({ where: { status: "unpaid" } }),
    prisma.invoice.count({ where: { status: "overdue" } }),
    prisma.invoice.count(),
    prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: "paid",
        periodMonth: currentMonth,
        periodYear: currentYear,
      },
    }),
    prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: "unpaid",
        periodMonth: currentMonth,
        periodYear: currentYear,
      },
    }),
    prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: "overdue",
        periodMonth: currentMonth,
        periodYear: currentYear,
      },
    }),
  ]);

  return NextResponse.json({
    data: {
      totalRevenueThisMonth: revenueThisMonth._sum.totalAmount ?? 0,
      totalPendingAmount: pendingThisMonth._sum.totalAmount ?? 0,
      totalOverdueAmount: overdueThisMonth._sum.totalAmount ?? 0,
      paidCount,
      unpaidCount,
      overdueCount,
      totalInvoicesCount,
    },
  });
});
