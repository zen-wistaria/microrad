import { mockDb } from "../mock/db";
import type { Permission, Role } from "../types";

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getRoles(): Promise<Role[]> {
  await delay();
  return mockDb.getRoles();
}

export async function getRoleById(id: string): Promise<Role | null> {
  await delay();
  return mockDb.getRoleById(id) ?? null;
}

export async function createRole(data: {
  name: string;
  description?: string;
  permissions: Permission[];
}): Promise<Role> {
  await delay();
  return mockDb.createRole(data);
}

export async function updateRole(
  id: string,
  updates: {
    name?: string;
    description?: string;
    permissions?: Permission[];
  },
): Promise<Role> {
  await delay();
  const role = mockDb.updateRole(id, updates);
  if (!role) {
    throw new Error("Role tidak ditemukan.");
  }
  return role;
}

export async function deleteRole(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  await delay();
  return mockDb.deleteRole(id);
}
