import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/** Bulan-bulan yang punya invoice (opsi filter dinamis) — urut desc */
export const GET = asyncApi(async () => {
  await requirePermission("billing.read");
  const months = await prisma.invoice.findMany({
    select: { periodMonth: true },
    distinct: ["periodMonth"],
    orderBy: { periodMonth: "desc" },
  });
  return NextResponse.json({ data: months.map((m) => m.periodMonth) });
});
