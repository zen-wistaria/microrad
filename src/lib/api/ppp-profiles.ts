import type { PppProfile } from "../types";
import { apiFetch, paginated } from "./client";

export interface GetPppProfilesParams {
  search?: string;
  page?: number;
  limit?: number;
}

export async function getPppProfilesPaginated(
  params?: GetPppProfilesParams,
): Promise<{ data: PppProfile[]; total: number }> {
  return paginated<PppProfile>("/ppp-profiles", {
    search: params?.search,
    page: params?.page,
    limit: params?.limit ?? 10,
  });
}

export async function getPppProfiles(
  params?: GetPppProfilesParams,
): Promise<{ data: PppProfile[]; total: number }> {
  return getPppProfilesPaginated(params);
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
