import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/** Ringkasan billing — revenue/pending/overdue periode berjalan + counts semua */
export const GET = asyncApi(async () => {
  await requirePermission("billing.read");
  const invoices = await prisma.invoice.findMany();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  let totalRevenueThisMonth = 0;
  let totalPendingAmount = 0;
  let totalOverdueAmount = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let overdueCount = 0;

  for (const inv of invoices) {
    const isCurrent =
      inv.periodMonth === currentMonth && inv.periodYear === currentYear;
    if (inv.status === "paid") {
      if (isCurrent) totalRevenueThisMonth += inv.totalAmount;
      paidCount++;
    } else if (inv.status === "unpaid") {
      if (isCurrent) totalPendingAmount += inv.totalAmount;
      unpaidCount++;
    } else if (inv.status === "overdue") {
      if (isCurrent) totalOverdueAmount += inv.totalAmount;
      overdueCount++;
    }
  }

  return NextResponse.json({
    data: {
      totalRevenueThisMonth,
      totalPendingAmount,
      totalOverdueAmount,
      paidCount,
      unpaidCount,
      overdueCount,
      totalInvoicesCount: invoices.length,
    },
  });
});
