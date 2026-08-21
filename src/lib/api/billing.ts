import type {
  BillingSummary,
  Invoice,
  PaymentMethod,
  PaymentRecord,
} from "@/lib/types";
import { apiFetch, paginated } from "./client";

export interface GetInvoicesParams {
  search?: string;
  status?: string;
  month?: string;
  paysearch?: string;
  tab?: string;
  page?: number;
  limit?: number;
}

export async function getInvoicesPaginated(
  params?: GetInvoicesParams,
): Promise<{ data: Invoice[]; total: number }> {
  return paginated<Invoice>("/billing", {
    search: params?.search,
    status: params?.status,
    month: params?.month,
    tab: "invoices",
    page: params?.page,
    limit: params?.limit,
  });
}

export async function getPaymentsPaginated(params?: {
  paysearch?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: PaymentRecord[]; total: number }> {
  return paginated<PaymentRecord>("/billing", {
    paysearch: params?.paysearch,
    tab: "payments",
    page: params?.page,
    limit: params?.limit,
  });
}

export function getInvoices(params?: GetInvoicesParams): Promise<Invoice[]> {
  if (params?.page !== undefined && params?.limit !== undefined) {
    return getInvoicesPaginated(params).then((r) => r.data);
  }
  // Tanpa pagination → semua invoice
  return apiFetch<{ data: Invoice[]; total: number }>(
    `/billing?tab=invoices&limit=1000`,
  ).then((r) => r.data);
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  return apiFetch<{ data: Invoice | null }>(`/billing/${id}`).then(
    (r) => r.data,
  );
}

export interface CreateInvoiceInput {
  customerId: string;
  customerUsername: string;
  customerFullName?: string;
  customerPhone?: string;
  customerAddress?: string;
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
  status: Invoice["status"];
  issueDate?: string;
  dueDate?: string;
  notes?: string;
}

/** Buat invoice manual — server hitung due date (periode + 1 bulan) & nomor */
export async function createInvoiceForCustomer(
  data: CreateInvoiceInput,
): Promise<Invoice> {
  return apiFetch<{ data: Invoice }>("/billing", {
    method: "POST",
    body: JSON.stringify({
      customerId: data.customerId,
      periodMonth: data.periodMonth,
      periodYear: data.periodYear,
      subtotal: data.subtotal,
      tax: data.tax,
      discount: data.discount,
      adminFee: data.adminFee,
      installationFee: data.installationFee,
      taxPercent: data.taxPercent,
      totalAmount: data.totalAmount,
      dueDate: data.dueDate,
      notes: data.notes,
    }),
  }).then((r) => r.data);
}

export async function createInvoice(
  payload: Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "updatedAt">,
): Promise<Invoice> {
  return createInvoiceForCustomer(payload as CreateInvoiceInput);
}

export async function updateInvoice(
  id: string,
  payload: Partial<Invoice>,
): Promise<Invoice> {
  return apiFetch<{ data: Invoice }>(`/billing/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }).then((r) => r.data);
}

export async function deleteInvoice(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/billing/${id}`, {
    method: "DELETE",
  });
}

/** Tandai lunas — server transaksional: update invoice + insert payment record */
export async function markInvoiceAsPaid(
  id: string,
  paymentData: {
    paymentMethod: PaymentMethod;
    paymentReference?: string;
    paidAt?: string;
    notes?: string;
  },
): Promise<Invoice> {
  return apiFetch<{ data: Invoice }>(`/billing/${id}/pay`, {
    method: "POST",
    body: JSON.stringify(paymentData),
  }).then((r) => r.data);
}

export interface BulkGenerateResult {
  createdCount: number;
  failedCount: number;
  skippedCount: number;
  invoices: Invoice[];
}

export async function bulkGenerateInvoices(
  month: number,
  year: number,
): Promise<BulkGenerateResult> {
  return apiFetch<{ data: BulkGenerateResult }>("/billing/bulk-generate", {
    method: "POST",
    body: JSON.stringify({ month, year }),
  }).then((r) => r.data);
}

export async function getPayments(): Promise<PaymentRecord[]> {
  return apiFetch<{ data: PaymentRecord[]; total: number }>(
    `/billing?tab=payments&limit=1000`,
  ).then((r) => r.data);
}

export async function getBillingSummary(): Promise<BillingSummary> {
  return apiFetch<{ data: BillingSummary }>("/billing/summary").then(
    (r) => r.data,
  );
}

export async function sendInvoiceReminder(id: string): Promise<{
  success: boolean;
  message: string;
  phone?: string;
  text: string;
}> {
  return apiFetch<{
    data: { success: boolean; message: string; phone?: string; text: string };
  }>(`/billing/${id}/reminder`, {
    method: "POST",
    body: JSON.stringify({}),
  }).then((r) => r.data);
}

/**
 * Due date otomatis (PURE — dipakai dialog untuk preview):
 * periode + 1 bulan; hari = tanggal registrasi pelanggan (fallback 10);
 * jam 23:59:59; normalisasi akhir bulan.
 */
export function getDueDateFromPeriod(
  year: number,
  month: number,
  createdAt?: string | null,
): string {
  const reg = createdAt ? new Date(createdAt) : new Date();
  const regDate = Number.isNaN(reg.getTime()) ? 10 : reg.getDate();
  const due = new Date(year, month, regDate, 23, 59, 59);
  if (due.getMonth() !== month % 12) {
    due.setDate(0);
    due.setHours(23, 59, 59, 0);
  }
  const mm = String(due.getMonth() + 1).padStart(2, "0");
  const dd = String(due.getDate()).padStart(2, "0");
  const hh = String(due.getHours()).padStart(2, "0");
  const mi = String(due.getMinutes()).padStart(2, "0");
  return `${due.getFullYear()}-${mm}-${dd}T${hh}:${mi}`;
}
