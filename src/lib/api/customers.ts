import { mockDb } from "../mock/db";
import type { Customer } from "../types";

// Simulated network latency
const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

export interface GetCustomersParams {
  search?: string;
  status?: string;
  profileId?: string;
}

export async function getCustomers(
  params?: GetCustomersParams,
): Promise<Customer[]> {
  await delay();
  return mockDb.getCustomers(params);
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  await delay();
  const customer = mockDb.getCustomerById(id);
  return customer || null;
}

export async function createCustomer(
  data: Omit<Customer, "id" | "createdAt" | "updatedAt">,
): Promise<Customer> {
  await delay();
  // Uniqueness check for username
  const existing = mockDb.getCustomerByUsername(data.username);
  if (existing) {
    throw new Error(`Username PPPoE '${data.username}' sudah terdaftar.`);
  }
  return mockDb.createCustomer(data);
}

export async function updateCustomer(
  id: string,
  updates: Partial<Customer>,
): Promise<Customer> {
  await delay();
  if (updates.username) {
    const existing = mockDb.getCustomerByUsername(updates.username);
    if (existing && existing.id !== id) {
      throw new Error(
        `Username PPPoE '${updates.username}' sudah digunakan pelanggan lain.`,
      );
    }
  }
  const updated = mockDb.updateCustomer(id, updates);
  if (!updated) {
    throw new Error("Pelanggan tidak ditemukan.");
  }
  return updated;
}

export async function deleteCustomer(
  id: string,
): Promise<{ success: boolean }> {
  await delay();
  const ok = mockDb.deleteCustomer(id);
  if (!ok) {
    throw new Error("Gagal menghapus pelanggan.");
  }
  return { success: true };
}

export async function disconnectCustomer(
  id: string,
): Promise<{ success: boolean }> {
  await delay();
  const ok = mockDb.disconnectCustomer(id);
  return { success: ok };
}
