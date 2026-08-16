import type { BandwidthProfile } from "@/lib/types";
import { apiFetch } from "./client";

export async function getProfiles(): Promise<BandwidthProfile[]> {
  return apiFetch<{ data: BandwidthProfile[] }>("/profiles").then(
    (r) => r.data,
  );
}

export async function getProfileById(
  id: string,
): Promise<BandwidthProfile | null> {
  return apiFetch<{ data: BandwidthProfile | null }>(`/profiles/${id}`).then(
    (r) => r.data,
  );
}

export async function createProfile(
  data: Omit<BandwidthProfile, "id" | "customerCount">,
): Promise<BandwidthProfile> {
  return apiFetch<{ data: BandwidthProfile }>("/profiles", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((r) => r.data);
}

export async function updateProfile(
  id: string,
  updates: Partial<BandwidthProfile>,
): Promise<BandwidthProfile> {
  return apiFetch<{ data: BandwidthProfile }>(`/profiles/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  }).then((r) => r.data);
}

export async function deleteProfile(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/profiles/${id}`, {
    method: "DELETE",
  });
}
