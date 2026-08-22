import type { Bandwidth } from "../types";
import { apiFetch } from "./client";

export async function getBandwidths(): Promise<{ data: Bandwidth[] }> {
  return apiFetch<{ data: Bandwidth[] }>("/bandwidths");
}

export async function getBandwidthById(
  id: string,
): Promise<{ data: Bandwidth }> {
  return apiFetch<{ data: Bandwidth }>(`/bandwidths/${id}`);
}

export async function createBandwidth(
  data: Partial<Bandwidth>,
): Promise<{ data: Bandwidth }> {
  return apiFetch<{ data: Bandwidth }>("/bandwidths", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateBandwidth(
  id: string,
  data: Partial<Bandwidth>,
): Promise<{ data: Bandwidth }> {
  return apiFetch<{ data: Bandwidth }>(`/bandwidths/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteBandwidth(
  id: string,
): Promise<{ data: { id: string; deleted: boolean } }> {
  return apiFetch<{ data: { id: string; deleted: boolean } }>(
    `/bandwidths/${id}`,
    {
      method: "DELETE",
    },
  );
}
