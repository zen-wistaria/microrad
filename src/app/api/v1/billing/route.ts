import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/** Serialisasi invoice Prisma → shape frontend (ISO + null → undefined) */
function serializeInvoice(inv: {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerUsername: string;
  customerFullName: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  profileId: string;
  profileName: string;
  periodMonth: number;
  periodYear: number;
  subtotal: number;
  tax: number;
  discount: number;
  adminFee: number;
  installationFee: number;
  taxPercent: number;
  totalAmount: number;
  status: string;
  issueDate: Date;
  dueDate: Date;
  paidAt: Date | null;
  paymentMethod: string | null;
  paymentReference: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...inv,
    customerFullName: inv.customerFullName ?? undefined,
    customerPhone: inv.customerPhone ?? undefined,
    customerAddress: inv.customerAddress ?? undefined,
    notes: inv.notes ?? undefined,
    paymentMethod: inv.paymentMethod ?? undefined,
    paymentReference: inv.paymentReference ?? undefined,
    issueDate: inv.issueDate.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    paidAt: inv.paidAt ? inv.paidAt.toISOString() : undefined,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

function serializePayment(p: {
  id: string;
  amount: number;
  paidAt: Date;
  [key: string]: unknown;
}) {
  return { ...p, paidAt: p.paidAt.toISOString() };
}

/**
 * Due date otomatis: PERIODE + 1 bulan.
 * Hari memakai tanggal registrasi pelanggan (fallback 10), jam 23:59:59;
 * normalisasi overflow (mis. 31 Feb) → hari terakhir bulan jatuh tempo.
 */
function getDueDateFromPeriod(
  year: number,
  month: number,
  createdAt?: Date | null,
): Date {
  const reg = createdAt ? new Date(createdAt) : new Date();
  const regDate = Number.isNaN(reg.getTime()) ? 10 : reg.getDate();
  const due = new Date(year, month, regDate, 23, 59, 59);
  if (due.getMonth() !== month % 12) {
    due.setDate(0);
    due.setHours(23, 59, 59, 0);
  }
  return due;
}

/** Nomor invoice: INV/<tahun>/<bulan>/<seq:03d> — seq = jumlah invoice periode + 1 */
async function nextInvoiceNumber(year: number, month: number): Promise<string> {
  const count = await prisma.invoice.count({
    where: { periodYear: year, periodMonth: month },
  });
  return `INV/${year}/${String(month).padStart(2, "0")}/${String(count + 1).padStart(3, "0")}`;
}

interface BillingQuery {
  search?: string;
  status?: string;
  month?: string;
  paysearch?: string;
  tab?: string;
  page?: number;
  limit?: number;
}

export const GET = asyncApi(async (req: Request) => {
  await requirePermission("billing.read");
  const url = new URL(req.url);
  const q: BillingQuery = {
    search: url.searchParams.get("search") || undefined,
    status: url.searchParams.get("status") || undefined,
    month: url.searchParams.get("month") || undefined,
    paysearch: url.searchParams.get("paysearch") || undefined,
    tab: url.searchParams.get("tab") || undefined,
    page: parseInt(url.searchParams.get("page") || "1", 10),
    limit: parseInt(url.searchParams.get("limit") || "10", 10),
  };

  const safeLimit = Math.min(Math.max(q.limit || 10, 1), 50);
  const safePage = Math.max(q.page || 1, 1);
  const tab = q.tab === "payments" ? "payments" : "invoices";

  // ── Filter invoice ──
  const invWhere: Record<string, unknown> = {};
  if (q.search) {
    invWhere.OR = [
      { customerUsername: { contains: q.search, mode: "insensitive" } },
      { customerFullName: { contains: q.search, mode: "insensitive" } },
      { invoiceNumber: { contains: q.search, mode: "insensitive" } },
    ];
  }
  if (q.status && q.status !== "all") invWhere.status = q.status;
  if (q.month && q.month !== "all") invWhere.periodMonth = Number(q.month);

  // ── Filter payment ──
  const payWhere: Record<string, unknown> = {};
  if (q.paysearch) {
    payWhere.OR = [
      { invoiceNumber: { contains: q.paysearch, mode: "insensitive" } },
      { customerName: { contains: q.paysearch, mode: "insensitive" } },
      { paymentReference: { contains: q.paysearch, mode: "insensitive" } },
    ];
  }

  if (tab === "invoices") {
    const [total, rows] = await Promise.all([
      prisma.invoice.count({ where: invWhere }),
      prisma.invoice.findMany({
        where: invWhere,
        orderBy: { issueDate: "desc" },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
    ]);
    const data = rows.map(serializeInvoice);
    return NextResponse.json({ data, total, tab: "invoices" });
  }

  // tab === "payments"
  const [total, rows] = await Promise.all([
    prisma.paymentRecord.count({ where: payWhere }),
    prisma.paymentRecord.findMany({
      where: payWhere,
      orderBy: { paidAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
  ]);
  return NextResponse.json({
    data: rows.map(serializePayment),
    total,
    tab: "payments",
  });
});

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("billing.create");
  const body = (await req.json()) as {
    customerId?: string;
    periodMonth?: number;
    periodYear?: number;
    subtotal?: number;
    tax?: number;
    discount?: number;
    adminFee?: number;
    installationFee?: number;
    taxPercent?: number;
    totalAmount?: number;
    notes?: string;
    dueDate?: string;
  };

  const customerId = body.customerId;
  const periodMonth = body.periodMonth;
  const periodYear = body.periodYear;
  if (!customerId || !periodMonth || !periodYear) {
    throw new Error("Data invoice tidak lengkap.");
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });
  if (!customer) throw new Error("Pelanggan tidak ditemukan.");
  const profile = customer.profileId
    ? await prisma.bandwidthProfile.findUnique({
        where: { id: customer.profileId },
      })
    : null;

  // Validasi PPN 0–100%
  const taxPercent = Math.min(100, Math.max(0, body.taxPercent ?? 0));
  if (taxPercent < 0 || taxPercent > 100) {
    throw new Error("PPN hanya boleh diisi antara 0% sampai 100%.");
  }

  // Duplikat (customerId, periodYear, periodMonth)
  const dup = await prisma.invoice.findFirst({
    where: {
      customerId,
      periodYear,
      periodMonth,
    },
  });
  if (dup) {
    throw new Error(
      `Pelanggan '${customer.username}' sudah memiliki tagihan pada periode ini. Hapus atau lunasi tagihan tersebut terlebih dahulu sebelum membuat tagihan baru.`,
    );
  }

  const subtotal = body.subtotal ?? 0;
  const tax = Math.round((subtotal * taxPercent) / 100);
  const adminFee = body.adminFee ?? 2500;
  const installationFee = body.installationFee ?? 0;
  const discount = body.discount ?? 0;
  const totalAmount = Math.max(
    0,
    subtotal + tax + adminFee + installationFee - discount,
  );
  const dueDate = body.dueDate
    ? new Date(`${body.dueDate}T23:59:59Z`)
    : getDueDateFromPeriod(periodYear, periodMonth, customer.createdAt);
  const invoiceNumber = await nextInvoiceNumber(periodYear, periodMonth);
  const now = new Date();
  const issueDate = now;

  const invoice = await prisma.invoice.create({
    data: {
      id: `inv-${Date.now()}`,
      invoiceNumber,
      customerId,
      customerUsername: customer.username,
      customerFullName: customer.fullName,
      customerPhone: customer.phone,
      customerAddress: customer.address,
      profileId: customer.profileId ?? "",
      profileName: profile?.name ?? "Paket Standar",
      periodMonth,
      periodYear,
      subtotal,
      tax,
      discount,
      adminFee,
      installationFee,
      taxPercent,
      totalAmount,
      status: "unpaid",
      issueDate,
      dueDate,
      notes: body.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    },
  });
  return NextResponse.json(
    { data: serializeInvoice(invoice) },
    { status: 201 },
  );
});

// dipakai bulk generate
export { getDueDateFromPeriod };
