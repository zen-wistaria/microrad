import { mockDb } from "../mock/db";
import type { CompanyProfile } from "../types";

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getCompanyProfile(): Promise<CompanyProfile> {
  await delay();
  return mockDb.getCompanyProfile();
}

export async function updateCompanyProfile(
  updates: Partial<CompanyProfile>,
): Promise<CompanyProfile> {
  await delay();
  if (
    updates.brandName !== undefined &&
    updates.brandName.trim().length === 0
  ) {
    throw new Error("Nama brand tidak boleh kosong.");
  }
  if (updates.fullName !== undefined && updates.fullName.trim().length === 0) {
    throw new Error("Nama panjang perusahaan tidak boleh kosong.");
  }
  return mockDb.updateCompanyProfile(updates);
}
