import type { ProfileGroup } from "../types";
import { apiFetch } from "./client";

export async function getProfileGroups(): Promise<{ data: ProfileGroup[] }> {
  return apiFetch<{ data: ProfileGroup[] }>("/profile-groups");
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
