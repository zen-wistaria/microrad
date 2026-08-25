import type { InternetProfile } from "../types";
import { apiFetch, paginated } from "./client";

export interface GetInternetProfilesParams {
  search?: string;
  page?: number;
  limit?: number;
}

export async function getInternetProfilesPaginated(
  params?: GetInternetProfilesParams,
): Promise<{ data: InternetProfile[]; total: number }> {
  return paginated<InternetProfile>("/internet-profiles", {
    search: params?.search,
    page: params?.page,
    limit: params?.limit ?? 10,
  });
}

export async function getInternetProfiles(
  params?: GetInternetProfilesParams,
): Promise<{ data: InternetProfile[]; total: number }> {
  return getInternetProfilesPaginated(params);
}

export async function getInternetProfileById(
  id: string,
): Promise<{ data: InternetProfile }> {
  return apiFetch<{ data: InternetProfile }>(`/internet-profiles/${id}`);
}

export async function createInternetProfile(
  data: Partial<InternetProfile>,
): Promise<{ data: InternetProfile }> {
  return apiFetch<{ data: InternetProfile }>("/internet-profiles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateInternetProfile(
  id: string,
  data: Partial<InternetProfile>,
): Promise<{ data: InternetProfile }> {
  return apiFetch<{ data: InternetProfile }>(`/internet-profiles/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteInternetProfile(
  id: string,
): Promise<{ data: { id: string; deleted: boolean } }> {
  return apiFetch<{ data: { id: string; deleted: boolean } }>(
    `/internet-profiles/${id}`,
    {
      method: "DELETE",
    },
  );
}
