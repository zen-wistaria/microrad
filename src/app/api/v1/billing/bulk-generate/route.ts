import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getDueDateFromPeriod } from "../route";

/**
 * Generate massal tagihan untuk periode (bulan, tahun).
 * Hanya pelanggan ACTIVE; skip bila sudah ada invoice periode tsb;
 * gagal bila pelanggan aktif tanpa profil valid.
 * Tax = 0, installationFee = 0, hanya subtotal + adminFee (2500).
 */
export const POST = asyncApi(async (req: Request) => {
  await requirePermission("billing.create");
  const body = (await req.json()) as { month?: number; year?: number };
  const month = body.month;
  const year = body.year;
  if (!month || !year || month < 1 || month > 12) {
    throw new Error("Periode tidak valid.");
  }

  const [customers, existingInvoices, initialCountInPeriod] = await Promise.all(
    [
      prisma.customer.findMany({ where: { status: "active" } }),
      prisma.invoice.findMany({
        where: { periodYear: year, periodMonth: month },
        select: { customerId: true },
      }),
      prisma.invoice.count({
        where: { periodYear: year, periodMonth: month },
      }),
    ],
  );
  const existingIds = new Set(existingInvoices.map((i) => i.customerId));

  const profiles = await prisma.bandwidthProfile.findMany();
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  const newlyCreated = [];
  const failedCustomers: string[] = [];
  let skippedCount = 0;
  const now = new Date();
  const monthStr = String(month).padStart(2, "0");

  for (const customer of customers) {
    if (existingIds.has(customer.id)) {
      skippedCount += 1;
      continue;
    }
    const profile = customer.profileId
      ? profileMap.get(customer.profileId)
      : null;
    if (!profile || !customer.profileId) {
      failedCustomers.push(customer.username);
      continue;
    }

    const subtotal = profile.price ?? 0;
    const adminFee = 2500;
    const totalAmount = subtotal + adminFee;
    const dueDate = getDueDateFromPeriod(year, month, customer.createdAt);
    const seq: number = initialCountInPeriod + newlyCreated.length + 1;

    newlyCreated.push({
      ...(customer ? {} : {}),
      id: `inv-${Date.now()}-${customer.id}`,
      invoiceNumber: `INV/${year}/${monthStr}/${String(seq).padStart(3, "0")}`,
      customerId: customer.id,
      customerUsername: customer.username,
      customerFullName: customer.fullName,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      profileId: customer.profileId,
      profileName: profile.name,
      periodMonth: month,
      periodYear: year,
      subtotal,
      tax: 0,
      discount: 0,
      adminFee,
      installationFee: 0,
      taxPercent: 0,
      totalAmount,
      status: "unpaid",
      issueDate: new Date(year, month - 1, 1, 8, 0, 0),
      dueDate,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (newlyCreated.length > 0) {
    await prisma.invoice.createMany({ data: newlyCreated });
  }

  const invoices = await prisma.invoice.findMany({
    where: { periodYear: year, periodMonth: month },
    orderBy: { issueDate: "desc" },
  });

  return NextResponse.json({
    data: {
      createdCount: newlyCreated.length,
      failedCount: failedCustomers.length,
      skippedCount,
      invoices,
    },
  });
});
