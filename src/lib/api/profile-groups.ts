import type { ProfileGroup } from "../types";
import { apiFetch, paginated } from "./client";

export interface GetProfileGroupsParams {
  search?: string;
  page?: number;
  limit?: number;
}

export async function getProfileGroupsPaginated(
  params?: GetProfileGroupsParams,
): Promise<{ data: ProfileGroup[]; total: number }> {
  return paginated<ProfileGroup>("/profile-groups", {
    search: params?.search,
    page: params?.page,
    limit: params?.limit ?? 10,
  });
}

export async function getProfileGroups(
  params?: GetProfileGroupsParams,
): Promise<{ data: ProfileGroup[]; total: number }> {
  return getProfileGroupsPaginated(params);
}

export async function getProfileGroupById(
  id: string,
): Promise<{ data: ProfileGroup }> {
  return apiFetch<{ data: ProfileGroup }>(`/profile-groups/${id}`);
}

export async function createProfileGroup(
  data: Partial<ProfileGroup>,
): Promise<{ data: ProfileGroup }> {
  return apiFetch<{ data: ProfileGroup }>("/profile-groups", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateProfileGroup(
  id: string,
  data: Partial<ProfileGroup>,
): Promise<{ data: ProfileGroup }> {
  return apiFetch<{ data: ProfileGroup }>(`/profile-groups/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProfileGroup(
  id: string,
): Promise<{ data: { id: string; deleted: boolean } }> {
  return apiFetch<{ data: { id: string; deleted: boolean } }>(
    `/profile-groups/${id}`,
    {
      method: "DELETE",
    },
  );
}
