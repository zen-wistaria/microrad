import type { AppUser } from "@/lib/types";
import { apiFetch, paginated } from "./client";

export async function getUsersPaginated(params?: {
  search?: string;
  status?: string;
  role?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: AppUser[]; total: number }> {
  return paginated<AppUser>("/users", {
    search: params?.search,
    status: params?.status,
    role: params?.role,
    page: params?.page,
    limit: params?.limit,
  });
}

export async function getUsers(params?: {
  search?: string;
  status?: string;
  role?: string;
  page?: number;
  limit?: number;
}): Promise<AppUser[]> {
  if (params?.page !== undefined && params?.limit !== undefined) {
    const res = await getUsersPaginated(params);
    return res.data;
  }
  // Tanpa pagination → semua (limit besar)
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.status && params.status !== "all") q.set("status", params.status);
  if (params?.role && params.role !== "all") q.set("role", params.role);
  q.set("limit", String(params?.limit ?? 1000));
  const res = await apiFetch<{ data: AppUser[] }>(`/users?${q.toString()}`);
  return res.data;
}

export async function getUserById(id: string): Promise<AppUser | null> {
  return apiFetch<{ data: AppUser | null }>(`/users/${id}`).then((r) => r.data);
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  const users = await getUsers();
  return (
    users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null
  );
}

export async function createUser(
  data: Omit<AppUser, "id" | "createdAt">,
): Promise<AppUser> {
  return apiFetch<{ data: AppUser }>("/users", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((r) => r.data);
}

export async function updateUser(
  id: string,
  updates: Partial<AppUser>,
): Promise<AppUser> {
  return apiFetch<{ data: AppUser }>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  }).then((r) => r.data);
}

export async function deleteUser(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/users/${id}`, {
    method: "DELETE",
  });
}
