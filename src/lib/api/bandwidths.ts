import type { Bandwidth } from "../types";
import { apiFetch, paginated } from "./client";

export interface GetBandwidthsParams {
  search?: string;
  page?: number;
  limit?: number;
}

export async function getBandwidthsPaginated(
  params?: GetBandwidthsParams,
): Promise<{ data: Bandwidth[]; total: number }> {
  return paginated<Bandwidth>("/bandwidths", {
    search: params?.search,
    page: params?.page,
    limit: params?.limit ?? 10,
  });
}

export async function getBandwidths(
  params?: GetBandwidthsParams,
): Promise<{ data: Bandwidth[]; total: number }> {
  return getBandwidthsPaginated(params);
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
