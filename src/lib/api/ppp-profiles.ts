import type { PppProfile } from "../types";
import { apiFetch } from "./client";

export async function getPppProfiles(): Promise<{ data: PppProfile[] }> {
  return apiFetch<{ data: PppProfile[] }>("/ppp-profiles");
}

export async function getPppProfileById(
  id: string,
): Promise<{ data: PppProfile }> {
  return apiFetch<{ data: PppProfile }>(`/ppp-profiles/${id}`);
}

export async function createPppProfile(
  data: Partial<PppProfile>,
): Promise<{ data: PppProfile }> {
  return apiFetch<{ data: PppProfile }>("/ppp-profiles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePppProfile(
  id: string,
  data: Partial<PppProfile>,
): Promise<{ data: PppProfile }> {
  return apiFetch<{ data: PppProfile }>(`/ppp-profiles/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePppProfile(
  id: string,
): Promise<{ data: { id: string; deleted: boolean } }> {
  return apiFetch<{ data: { id: string; deleted: boolean } }>(
    `/ppp-profiles/${id}`,
    {
      method: "DELETE",
    },
  );
}
