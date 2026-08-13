import { mockDb } from "../mock/db";
import type { BandwidthProfile } from "../types";

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getProfiles(): Promise<BandwidthProfile[]> {
  await delay();
  return mockDb.getProfiles();
}

export async function getProfileById(
  id: string,
): Promise<BandwidthProfile | null> {
  await delay();
  const profile = mockDb.getProfileById(id);
  return profile || null;
}

export async function createProfile(
  data: Omit<BandwidthProfile, "id" | "customerCount">,
): Promise<BandwidthProfile> {
  await delay();
  return mockDb.createProfile(data);
}

export async function updateProfile(
  id: string,
  updates: Partial<BandwidthProfile>,
): Promise<BandwidthProfile> {
  await delay();
  const updated = mockDb.updateProfile(id, updates);
  if (!updated) {
    throw new Error("Profil bandwidth tidak ditemukan.");
  }
  return updated;
}

export async function deleteProfile(id: string): Promise<{ success: boolean }> {
  await delay();
  const result = mockDb.deleteProfile(id);
  if (!result.success) {
    throw new Error(result.error || "Gagal menghapus profil bandwidth.");
  }
  return { success: true };
}
