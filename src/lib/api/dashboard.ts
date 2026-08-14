import { mockDb } from "../mock/db";
import type {
  CustomerDailyUsage,
  CustomerMonthlyUsage,
  DashboardStats,
} from "../types";

const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getDashboardStats(): Promise<DashboardStats> {
  await delay();
  return mockDb.getDashboardStats();
}

export async function getCustomerUsageHistory(
  customerId: string,
): Promise<CustomerDailyUsage[]> {
  await delay();
  return mockDb.getCustomerUsageHistory(customerId);
}

export async function getCustomerMonthlyUsage(
  customerId: string,
  year?: number,
): Promise<CustomerMonthlyUsage[]> {
  await delay();
  return mockDb.getCustomerMonthlyUsage(customerId, year);
}

export async function resetDemoData(): Promise<void> {
  await delay();
  mockDb.resetToDefaults();
}
