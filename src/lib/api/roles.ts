import type { Permission, Role } from "@/lib/types";
import { apiFetch } from "./client";

export async function getRoles(): Promise<Role[]> {
  return apiFetch<{ data: Role[] }>("/roles").then((r) => r.data);
}

export async function getRoleById(id: string): Promise<Role | null> {
  return apiFetch<{ data: Role | null }>(`/roles/${id}`).then((r) => r.data);
}

export async function createRole(data: {
  name: string;
  description?: string;
  permissions: Permission[];
}): Promise<Role> {
  return apiFetch<{ data: Role }>("/roles", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((r) => r.data);
}

export async function updateRole(
  id: string,
  updates: { name?: string; description?: string; permissions?: Permission[] },
): Promise<Role> {
  return apiFetch<{ data: Role }>(`/roles/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  }).then((r) => r.data);
}

export async function deleteRole(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const res = await apiFetch<{ success: boolean }>(`/roles/${id}`, {
      method: "DELETE",
    });
    return { success: res.success };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Gagal menghapus role.",
    };
  }
}
