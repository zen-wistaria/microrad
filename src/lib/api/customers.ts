import type { Customer } from "@/lib/types";
import { apiFetch, paginated } from "./client";

export interface GetCustomersParams {
  search?: string;
  status?: string;
  profileId?: string;
  page?: number;
  limit?: number;
}

/** List pelanggan terpaginasi dengan total — query param: search, status, profileId→profile, page, limit */
export async function getCustomersPaginated(
  params?: GetCustomersParams,
): Promise<{ data: Customer[]; total: number }> {
  return paginated<Customer>("/customers", {
    search: params?.search,
    status: params?.status,
    profile: params?.profileId,
    page: params?.page,
    limit: params?.limit,
  });
}

/** List pelanggan — query param: search, status, profileId→profile, page, limit */
export async function getCustomers(
  params?: GetCustomersParams,
): Promise<Customer[]> {
  if (params?.page !== undefined && params?.limit !== undefined) {
    const res = await getCustomersPaginated(params);
    return res.data;
  }
  // Tanpa pagination eksplisit → ambil semua (limit besar)
  const res = await apiFetch<{ data: Customer[] }>(
    `/customers${toQueryAll(params)}`,
  );
  return res.data;
}

function toQueryAll(params?: GetCustomersParams) {
  const search = new URLSearchParams();
  if (params?.search) search.set("search", params.search);
  if (params?.status && params.status !== "all")
    search.set("status", params.status);
  if (params?.profileId && params.profileId !== "all")
    search.set("profile", params.profileId);
  search.set("limit", String(params?.limit ?? 1000));
  const s = search.toString();
  return s ? `?${s}` : "";
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  return apiFetch<{ data: Customer | null }>(`/customers/${id}`).then(
    (r) => r.data,
  );
}

export async function createCustomer(
  data: Partial<Omit<Customer, "id" | "createdAt" | "updatedAt">>,
): Promise<Customer> {
  return apiFetch<{ data: Customer }>("/customers", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((r) => r.data);
}

export async function updateCustomer(
  id: string,
  updates: Partial<Customer>,
): Promise<Customer> {
  return apiFetch<{ data: Customer }>(`/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  }).then((r) => r.data);
}

export async function deleteCustomer(
  id: string,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/customers/${id}`, {
    method: "DELETE",
  });
}

export async function disconnectCustomer(
  id: string,
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/customers/${id}/disconnect`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}
