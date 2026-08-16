import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export const GET = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("billing.read");
  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new Error("Invoice tidak ditemukan.");
  return NextResponse.json({
    data: {
      ...invoice,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : undefined,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
    },
  });
});

export const PUT = asyncApi(async (req: Request, ctx: { params: Params }) => {
  await requirePermission("billing.update");
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    status?: string;
    notes?: string;
    dueDate?: string;
  };

  const existing = await prisma.invoice.findUnique({ where: { id } });
  if (!existing) throw new Error("Invoice tidak ditemukan.");

  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes || undefined } : {}),
      ...(body.dueDate !== undefined
        ? { dueDate: new Date(body.dueDate) }
        : {}),
    },
  });
  return NextResponse.json({
    data: {
      ...invoice,
      issueDate: invoice.issueDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
    },
  });
});

export const DELETE = asyncApi(
  async (_req: Request, ctx: { params: Params }) => {
    await requirePermission("billing.delete");
    const { id } = await ctx.params;
    const existing = await prisma.invoice.findUnique({ where: { id } });
    if (!existing) throw new Error("Invoice tidak ditemukan.");
    await prisma.invoice.delete({ where: { id } });
    return NextResponse.json({ success: true });
  },
);
