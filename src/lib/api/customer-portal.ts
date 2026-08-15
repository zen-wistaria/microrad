import {
  getPortalLoginLogs,
  getPortalSessionLogs,
  type LogLoginPortal,
  type LogSesiPppoe,
} from "../mock/portal-logs";
import type {
  AppUser,
  BandwidthProfile,
  Customer,
  CustomerDailyUsage,
  CustomerPortalSummary,
  Invoice,
  PaymentRecord,
  Session,
} from "../types";
import { getInvoices, getPayments } from "./billing";
import { getCustomers } from "./customers";
import { getCustomerUsageHistory } from "./dashboard";
import { getProfileById } from "./profiles";
import { getCustomerSessions } from "./sessions";

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export interface CustomerPortalData {
  customer: Customer;
  profile: BandwidthProfile | null;
  summary: CustomerPortalSummary;
  usageHistory: CustomerDailyUsage[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  sessions: Session[];
  loginLogs: LogLoginPortal[];
  sessionLogs: LogSesiPppoe[];
}

/** Resolve data pelanggan yang terhubung dengan akun login portal. */
export async function getCustomerPortalData(
  user: AppUser,
): Promise<CustomerPortalData> {
  await delay();
  const customers = await getCustomers();

  // 1. Prioritas: user.customerId (akun dibuat dengan link langsung ke pelanggan)
  let customer = user.customerId
    ? customers.find((c) => c.id === user.customerId)
    : undefined;

  // 2. Fallback: email akun sama dengan email pelanggan
  if (!customer && user.email) {
    customer = customers.find(
      (c) => c.email?.toLowerCase() === user.email.toLowerCase(),
    );
  }

  if (!customer) {
    throw new Error("Data pelanggan tidak ditemukan untuk akun ini.");
  }

  const [profile, usageHistory, invoices, payments, sessions] =
    await Promise.all([
      customer.profileId
        ? getProfileById(customer.profileId)
        : Promise.resolve(null),
      getCustomerUsageHistory(customer.id),
      getInvoices(),
      getPayments(),
      getCustomerSessions(customer.id),
    ]);

  const myInvoices = invoices.filter((inv) => inv.customerId === customer.id);

  // Summary
  const totalDownload30d = usageHistory.reduce(
    (acc, u) => acc + u.downloadBytes,
    0,
  );
  const totalUpload30d = usageHistory.reduce(
    (acc, u) => acc + u.uploadBytes,
    0,
  );

  const activeInvoices = myInvoices.filter(
    (inv) => inv.status === "unpaid" || inv.status === "overdue",
  );
  const totalOutstanding = activeInvoices.reduce(
    (acc, inv) => acc + inv.totalAmount,
    0,
  );
  const paidAmountTotal = myInvoices
    .filter((inv) => inv.status === "paid")
    .reduce((acc, inv) => acc + inv.totalAmount, 0);

  const onlineNow = sessions.some((s) => !s.stoppedAt);
  const onlineSessionCount = sessions.filter((s) => !s.stoppedAt).length;

  const summary: CustomerPortalSummary = {
    totalUsage30dBytes: totalDownload30d + totalUpload30d,
    totalDownload30dBytes: totalDownload30d,
    totalUpload30dBytes: totalUpload30d,
    onlineNow,
    onlineSessionCount,
    totalPaidAmount: paidAmountTotal,
    totalOutstandingAmount: totalOutstanding,
    activeInvoiceCount: activeInvoices.length,
  };

  return {
    customer,
    profile,
    summary,
    usageHistory,
    invoices: myInvoices,
    payments: payments.filter((p) => p.customerId === customer.id),
    sessions,
    loginLogs: getPortalLoginLogs(customer),
    sessionLogs: getPortalSessionLogs(customer, sessions),
  };
}
