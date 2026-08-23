import type { InternetProfile } from "../types";
import { apiFetch } from "./client";

export async function getInternetProfiles(): Promise<{
  data: InternetProfile[];
}> {
  return apiFetch<{ data: InternetProfile[] }>("/internet-profiles");
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
