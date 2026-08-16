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
): Promise<CustomerDailyUsage[]> {
  return apiFetch<{ data: { history: CustomerDailyUsage[] } }>(
    `/dashboard/customers/${customerId}/usage`,
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

/** Reset Demo — bersihkan & seed ulang data (admin) */
export async function resetDemoData(): Promise<void> {
  await apiFetch<{ success: boolean }>("/demo/reset", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
