import { mockDb } from "../mock/db";
import type { AppUser } from "../types";

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getUsers(): Promise<AppUser[]> {
  await delay();
  return mockDb.getUsers();
}

export async function getUserById(id: string): Promise<AppUser | null> {
  await delay();
  const user = mockDb.getUserById(id);
  return user || null;
}

export async function getUserByEmail(email: string): Promise<AppUser | null> {
  await delay();
  const user = mockDb.getUserByEmail(email);
  return user || null;
}

export async function createUser(
  data: Omit<AppUser, "id" | "createdAt">,
): Promise<AppUser> {
  await delay();
  const existing = mockDb.getUserByEmail(data.email);
  if (existing) {
    throw new Error(
      `Email '${data.email}' sudah terdaftar untuk pengguna lain.`,
    );
  }
  return mockDb.createUser(data);
}

export async function updateUser(
  id: string,
  updates: Partial<AppUser>,
): Promise<AppUser> {
  await delay();
  if (updates.email) {
    const existing = mockDb.getUserByEmail(updates.email);
    if (existing && existing.id !== id) {
      throw new Error(
        `Email '${updates.email}' sudah digunakan oleh akun lain.`,
      );
    }
  }
  const updated = mockDb.updateUser(id, updates);
  if (!updated) {
    throw new Error("Pengguna aplikasi tidak ditemukan.");
  }
  return updated;
}

export async function deleteUser(id: string): Promise<{ success: boolean }> {
  await delay();
  const ok = mockDb.deleteUser(id);
  if (!ok) {
    throw new Error(
      "Tidak dapat menghapus satu-satunya akun pengguna yang tersisa.",
    );
  }
  return { success: true };
}
