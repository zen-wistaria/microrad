import type { PppProfile } from "../types";
import { apiFetch, paginated } from "./client";

export interface GetProfilesParams {
  search?: string;
  serviceType?: string;
  page?: number;
  limit?: number;
}

export async function getProfilesPaginated(
  params?: GetProfilesParams,
): Promise<{ data: PppProfile[]; total: number }> {
  return paginated<PppProfile>("/profiles", {
    search: params?.search,
    serviceType: params?.serviceType,
    page: params?.page,
    limit: params?.limit ?? 10,
  });
}

export async function getProfiles(
  params?: GetProfilesParams,
): Promise<{ data: PppProfile[]; total: number }> {
  return getProfilesPaginated(params);
}

export async function getProfileById(
  id: string,
): Promise<{ data: PppProfile }> {
  return apiFetch<{ data: PppProfile }>(`/profiles/${id}`);
}

export async function createProfile(
  data: Partial<PppProfile>,
): Promise<{ data: PppProfile }> {
  return apiFetch<{ data: PppProfile }>("/profiles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProfile(
  id: string,
  data: Partial<PppProfile>,
): Promise<{ data: PppProfile }> {
  return apiFetch<{ data: PppProfile }>(`/profiles/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProfile(
  id: string,
): Promise<{ data: { id: string; deleted: boolean } }> {
  return apiFetch<{ data: { id: string; deleted: boolean } }>(
    `/profiles/${id}`,
    {
      method: "DELETE",
    },
  );
}

// Backward compatibility aliases
export type GetPppProfilesParams = GetProfilesParams;
export const getPppProfilesPaginated = getProfilesPaginated;
export const getPppProfiles = getProfiles;
export const getPppProfileById = getProfileById;
export const createPppProfile = createProfile;
export const updatePppProfile = updateProfile;
export const deletePppProfile = deleteProfile;
