import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@/lib/types";

type Params = Promise<{ id: string }>;

/**
 * Tandai invoice lunas — TRANSAKSIONAL:
 * 1) update invoice → paid (+paidAt, paymentMethod, paymentReference, notes)
 * 2) insert PaymentRecord (riwayat pembayaran)
 */
export const POST = asyncApi(async (req: Request, ctx: { params: Params }) => {
  await requirePermission("billing.update");
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    paymentMethod?: PaymentMethod;
    paymentReference?: string;
    paidAt?: string;
    notes?: string;
  };

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new Error("Invoice tidak ditemukan.");

  const now = body.paidAt ? new Date(body.paidAt) : new Date();
  const paymentReference =
    body.paymentReference || `PAY-${Date.now().toString().slice(-6)}`;
  const paymentMethod = body.paymentMethod ?? "qris";

  await prisma.$transaction([
    prisma.invoice.update({
      where: { id },
      data: {
        status: "paid",
        paidAt: now,
        paymentMethod,
        paymentReference,
        notes: body.notes?.trim() || invoice.notes || undefined,
        updatedAt: now,
      },
    }),
    prisma.paymentRecord.create({
      data: {
        id: `pay-${Date.now()}`,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        customerId: invoice.customerId,
        customerName: invoice.customerFullName || invoice.customerUsername,
        amount: invoice.totalAmount,
        paymentMethod,
        paymentReference,
        paidAt: now,
        receivedBy: "Operator Dashboard",
        notes: body.notes?.trim() || undefined,
      },
    }),
  ]);

  const updated = await prisma.invoice.findUnique({ where: { id } });
  if (!updated) throw new Error("Invoice tidak ditemukan.");
  return NextResponse.json({
    data: {
      ...updated,
      issueDate: updated.issueDate.toISOString(),
      dueDate: updated.dueDate.toISOString(),
      paidAt: updated.paidAt ? updated.paidAt.toISOString() : undefined,
    },
  });
});
