import { initialInvoices, initialPayments } from "../mock/billing.mock";
import type {
  BillingSummary,
  Invoice,
  PaymentMethod,
  PaymentRecord,
} from "../types";
import { getCustomers } from "./customers";
import { getProfiles } from "./profiles";

const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

const INVOICES_STORAGE_KEY = "microrad_invoices_mock";
const PAYMENTS_STORAGE_KEY = "microrad_payments_mock";

function loadInvoicesFromStorage(): Invoice[] {
  if (typeof window === "undefined") return initialInvoices;
  try {
    const raw = localStorage.getItem(INVOICES_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(
        INVOICES_STORAGE_KEY,
        JSON.stringify(initialInvoices),
      );
      return initialInvoices;
    }
    return JSON.parse(raw);
  } catch {
    return initialInvoices;
  }
}

function saveInvoicesToStorage(invoices: Invoice[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
  }
}

function loadPaymentsFromStorage(): PaymentRecord[] {
  if (typeof window === "undefined") return initialPayments;
  try {
    const raw = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(
        PAYMENTS_STORAGE_KEY,
        JSON.stringify(initialPayments),
      );
      return initialPayments;
    }
    return JSON.parse(raw);
  } catch {
    return initialPayments;
  }
}

function savePaymentsToStorage(payments: PaymentRecord[]) {
  if (typeof window !== "undefined") {
    localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(payments));
  }
}

export async function getInvoices(): Promise<Invoice[]> {
  await delay(120);
  return loadInvoicesFromStorage();
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
  await delay(100);
  const invoices = loadInvoicesFromStorage();
  return invoices.find((inv) => inv.id === id) || null;
}

export async function createInvoice(
  payload: Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "updatedAt">,
): Promise<Invoice> {
  await delay(200);
  const invoices = loadInvoicesFromStorage();

  const year = payload.periodYear || new Date().getFullYear();
  const month = String(
    payload.periodMonth || new Date().getMonth() + 1,
  ).padStart(2, "0");
  const countThisMonth = invoices.filter(
    (i) => i.periodYear === year && i.periodMonth === Number(month),
  ).length;

  const invoiceNumber = `INV/${year}/${month}/${String(countThisMonth + 1).padStart(3, "0")}`;
  const id = `inv-${Date.now()}`;
  const now = new Date().toISOString();

  const newInvoice: Invoice = {
    ...payload,
    id,
    invoiceNumber,
    createdAt: now,
    updatedAt: now,
  };

  const updated = [newInvoice, ...invoices];
  saveInvoicesToStorage(updated);
  return newInvoice;
}

export async function updateInvoice(
  id: string,
  payload: Partial<Invoice>,
): Promise<Invoice> {
  await delay(180);
  const invoices = loadInvoicesFromStorage();
  const index = invoices.findIndex((i) => i.id === id);
  if (index === -1) throw new Error("Invoice tidak ditemukan");

  const updatedItem: Invoice = {
    ...invoices[index],
    ...payload,
    updatedAt: new Date().toISOString(),
  };

  invoices[index] = updatedItem;
  saveInvoicesToStorage(invoices);
  return updatedItem;
}

export async function deleteInvoice(id: string): Promise<void> {
  await delay(150);
  const invoices = loadInvoicesFromStorage();
  const filtered = invoices.filter((i) => i.id !== id);
  saveInvoicesToStorage(filtered);
}

export async function markInvoiceAsPaid(
  id: string,
  paymentData: {
    paymentMethod: PaymentMethod;
    paymentReference?: string;
    paidAt?: string;
    notes?: string;
  },
): Promise<Invoice> {
  await delay(200);
  const invoices = loadInvoicesFromStorage();
  const index = invoices.findIndex((i) => i.id === id);
  if (index === -1) throw new Error("Invoice tidak ditemukan");

  const inv = invoices[index];
  const now = paymentData.paidAt || new Date().toISOString();

  const updatedInv: Invoice = {
    ...inv,
    status: "paid",
    paidAt: now,
    paymentMethod: paymentData.paymentMethod,
    paymentReference:
      paymentData.paymentReference || `PAY-${Date.now().toString().slice(-6)}`,
    notes: paymentData.notes || inv.notes,
    updatedAt: now,
  };

  invoices[index] = updatedInv;
  saveInvoicesToStorage(invoices);

  // Add to Payment Record history
  const payments = loadPaymentsFromStorage();
  const newPayment: PaymentRecord = {
    id: `pay-${Date.now()}`,
    invoiceId: inv.id,
    invoiceNumber: inv.invoiceNumber,
    customerId: inv.customerId,
    customerName: inv.customerFullName || inv.customerUsername,
    amount: inv.totalAmount,
    paymentMethod: paymentData.paymentMethod,
    paymentReference: updatedInv.paymentReference,
    paidAt: now,
    receivedBy: "Operator Dashboard",
    notes: paymentData.notes,
  };

  savePaymentsToStorage([newPayment, ...payments]);

  return updatedInv;
}

export async function bulkGenerateInvoices(
  month: number,
  year: number,
  dueDateDay = 10,
): Promise<{ createdCount: number; invoices: Invoice[] }> {
  await delay(300);
  const [customers, profiles, existingInvoices] = await Promise.all([
    getCustomers(),
    getProfiles(),
    getInvoices(),
  ]);

  const activeCustomers = customers.filter((c) => c.status === "active");
  const newlyCreated: Invoice[] = [];
  const now = new Date().toISOString();

  const dueMonthStr = String(month).padStart(2, "0");
  const dueDayStr = String(dueDateDay).padStart(2, "0");
  const dueDate = `${year}-${dueMonthStr}-${dueDayStr}T23:59:59Z`;

  for (const customer of activeCustomers) {
    // Check if invoice already exists for this customer in this period
    const exists = existingInvoices.some(
      (inv) =>
        inv.customerId === customer.id &&
        inv.periodMonth === month &&
        inv.periodYear === year,
    );

    if (!exists) {
      const profile = profiles.find((p) => p.id === customer.profileId);
      const subtotal = profile?.price || 150000;
      const adminFee = 2500;
      const totalAmount = subtotal + adminFee;
      const seq = existingInvoices.length + newlyCreated.length + 1;
      const invoiceNumber = `INV/${year}/${dueMonthStr}/${String(seq).padStart(3, "0")}`;

      const inv: Invoice = {
        id: `inv-${Date.now()}-${customer.id}`,
        invoiceNumber,
        customerId: customer.id,
        customerUsername: customer.username,
        customerFullName: customer.fullName,
        customerPhone: customer.phone,
        customerAddress: customer.address,
        profileId: customer.profileId,
        profileName: profile?.name || "Paket Internet",
        periodMonth: month,
        periodYear: year,
        subtotal,
        tax: 0,
        discount: 0,
        adminFee,
        totalAmount,
        status: "unpaid",
        issueDate: `${year}-${dueMonthStr}-01T08:00:00Z`,
        dueDate,
        createdAt: now,
        updatedAt: now,
      };
      newlyCreated.push(inv);
    }
  }

  const allInvoices = [...newlyCreated, ...existingInvoices];
  saveInvoicesToStorage(allInvoices);

  return {
    createdCount: newlyCreated.length,
    invoices: allInvoices,
  };
}

export async function getPayments(): Promise<PaymentRecord[]> {
  await delay(100);
  return loadPaymentsFromStorage();
}

export async function getBillingSummary(): Promise<BillingSummary> {
  const invoices = await getInvoices();
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  let totalRevenueThisMonth = 0;
  let totalPendingAmount = 0;
  let totalOverdueAmount = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let overdueCount = 0;

  for (const inv of invoices) {
    if (inv.periodMonth === currentMonth && inv.periodYear === currentYear) {
      if (inv.status === "paid") {
        totalRevenueThisMonth += inv.totalAmount;
        paidCount++;
      } else if (inv.status === "unpaid") {
        totalPendingAmount += inv.totalAmount;
        unpaidCount++;
      } else if (inv.status === "overdue") {
        totalOverdueAmount += inv.totalAmount;
        overdueCount++;
      }
    } else {
      // Historical or future
      if (inv.status === "paid") paidCount++;
      else if (inv.status === "unpaid") unpaidCount++;
      else if (inv.status === "overdue") overdueCount++;
    }
  }

  return {
    totalRevenueThisMonth,
    totalPendingAmount,
    totalOverdueAmount,
    paidCount,
    unpaidCount,
    overdueCount,
    totalInvoicesCount: invoices.length,
  };
}

export async function sendInvoiceReminder(id: string): Promise<{
  success: boolean;
  message: string;
  phone?: string;
  text: string;
}> {
  await delay(250);
  const inv = await getInvoiceById(id);
  if (!inv) throw new Error("Invoice tidak ditemukan");

  const formattedAmount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(inv.totalAmount);

  const text = `Halo *${inv.customerFullName || inv.customerUsername}*,\n\nIni adalah pengingat tagihan internet PPPoE (${inv.profileName}) untuk periode *Bulan ${inv.periodMonth}/${inv.periodYear}* sebesar *${formattedAmount}*.\n\nNomor Tagihan: *${inv.invoiceNumber}*\nJatuh Tempo: *${new Date(inv.dueDate).toLocaleDateString("id-ID")}*\n\nSilakan lakukan pembayaran melalui Transfer Bank atau QRIS. Terima kasih!`;

  return {
    success: true,
    message: `Pengingat WhatsApp berhasil dikirim ke ${inv.customerPhone || "nomor pelanggan"}`,
    phone: inv.customerPhone,
    text,
  };
}
