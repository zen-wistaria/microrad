import type { CompanyProfile } from "@/lib/types";
import { apiFetch } from "./client";

export async function getCompanyProfile(): Promise<CompanyProfile> {
  return apiFetch<{ data: CompanyProfile }>("/settings").then((r) => r.data);
}

export async function updateCompanyProfile(
  updates: Partial<CompanyProfile>,
): Promise<CompanyProfile> {
  return apiFetch<{ data: CompanyProfile }>("/settings", {
    method: "PUT",
    body: JSON.stringify(updates),
  }).then((r) => r.data);
}

/** Template WhatsApp (disimpan server, tidak dihapus saat reset) */
export async function getWaTemplate(): Promise<string> {
  return apiFetch<{ data: string }>("/settings/wa-template").then(
    (r) => r.data,
  );
}

export async function saveWaTemplate(template: string): Promise<string> {
  return apiFetch<{ data: string }>("/settings/wa-template", {
    method: "PUT",
    body: JSON.stringify({ template }),
  }).then((r) => r.data);
}
