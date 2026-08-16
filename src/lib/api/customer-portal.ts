import type { LogLoginPortal, LogSesiPppoe } from "@/lib/mock/portal-logs";
import type {
  BandwidthProfile,
  Customer,
  CustomerDailyUsage,
  CustomerMonthlyUsage,
  CustomerPortalSummary,
  Invoice,
  PaymentRecord,
  Session,
} from "@/lib/types";
import { apiFetch } from "./client";

export interface CustomerPortalData {
  customer: Customer;
  profile: BandwidthProfile | null;
  summary: CustomerPortalSummary;
  usageHistory: CustomerDailyUsage[];
  monthlyUsage: CustomerMonthlyUsage[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  sessions: Session[];
  loginLogs: LogLoginPortal[];
  sessionLogs: LogSesiPppoe[];
}

/**
 * Agregat data portal pelanggan — sesi portal (cookie) dari Better Auth #2.
 * GET /api/v1/portal/me
 */
export async function getCustomerPortalData(): Promise<CustomerPortalData> {
  return apiFetch<{ data: CustomerPortalData }>("/portal/me").then(
    (r) => r.data,
  );
}
