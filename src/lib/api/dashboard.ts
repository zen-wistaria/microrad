import type {
  CustomerDailyUsage,
  CustomerMonthlyUsage,
  DashboardStats,
} from "@/lib/types";
import { apiFetch } from "./client";

export async function getDashboardStats(): Promise<DashboardStats> {
  return apiFetch<{ data: DashboardStats }>("/dashboard").then((r) => r.data);
}

export async function getCustomerUsageHistory(
  customerId: string,
  params?: { year?: number; month?: number },
): Promise<CustomerDailyUsage[]> {
  const q = new URLSearchParams();
  if (params?.year) q.set("year", String(params.year));
  if (params?.month) q.set("month", String(params.month));
  const qs = q.toString();
  return apiFetch<{ data: { history: CustomerDailyUsage[] } }>(
    `/dashboard/customers/${customerId}/usage${qs ? `?${qs}` : ""}`,
  ).then((r) => r.data.history);
}

export async function getCustomerMonthlyUsage(
  customerId: string,
  year?: number,
): Promise<CustomerMonthlyUsage[]> {
  const q = year ? `?year=${year}` : "";
  return apiFetch<{ data: { monthly: CustomerMonthlyUsage[] } }>(
    `/dashboard/customers/${customerId}/usage${q}`,
  ).then((r) => r.data.monthly);
}
