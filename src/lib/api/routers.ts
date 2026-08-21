import type { NasRouter } from "@/lib/types";
import { apiFetch } from "./client";

export async function getRouters(): Promise<NasRouter[]> {
  return apiFetch<{ data: NasRouter[] }>("/routers").then((r) => r.data);
}

export async function getRouterById(id: string): Promise<NasRouter | null> {
  return apiFetch<{ data: NasRouter | null }>(`/routers/${id}`).then(
    (r) => r.data,
  );
}

/** Payload pembuatan/perubahan router (termasuk kredensial yang tidak
 * diekspos di NasRouter — dirahasiakan dari client) */
export interface RouterPayload
  extends Omit<NasRouter, "id" | "activeSessionCount"> {
  apiUsername?: string;
  apiPassword?: string;
  apiPasswordSet?: never;
  apiPort?: number;
  radiusSecret?: string;
  syncEnabled?: boolean;
}

export async function createRouter(data: RouterPayload): Promise<NasRouter> {
  return apiFetch<{ data: NasRouter }>("/routers", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((r) => r.data);
}

export async function updateRouter(
  id: string,
  updates: Partial<RouterPayload>,
): Promise<NasRouter> {
  return apiFetch<{ data: NasRouter }>(`/routers/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  }).then((r) => r.data);
}

export async function deleteRouter(id: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/routers/${id}`, {
    method: "DELETE",
  });
}

export async function pingRouter(id: string): Promise<{
  status: "online" | "offline";
  latencyMs: number;
  identity?: string;
}> {
  return apiFetch<{
    data: {
      status: "online" | "offline";
      latencyMs: number;
      identity?: string;
    };
  }>(`/routers/${id}/ping`, { method: "POST", body: JSON.stringify({}) }).then(
    (r) => r.data,
  );
}

export async function connectRouterRadius(
  id: string,
): Promise<{ radiusEnabled: boolean; added: number; removed: number }> {
  return apiFetch<{
    data: { radiusEnabled: boolean; added: number; removed: number };
  }>(`/routers/${id}/connect-radius`, {
    method: "POST",
    body: JSON.stringify({}),
  }).then((r) => r.data);
}

export async function disconnectRouterRadius(
  id: string,
): Promise<{ radiusEnabled: boolean; removed: number }> {
  return apiFetch<{
    data: { radiusEnabled: boolean; removed: number };
  }>(`/routers/${id}/disconnect-radius`, {
    method: "POST",
    body: JSON.stringify({}),
  }).then((r) => r.data);
}

export async function syncRouterNow(id: string): Promise<{
  id: string;
  name: string;
  ipAddress: string;
  status: "online" | "offline";
  latencyMs: number;
  error?: string;
  created?: number;
  updated?: number;
  closed?: number;
}> {
  return apiFetch<{
    data: {
      id: string;
      name: string;
      ipAddress: string;
      status: "online" | "offline";
      latencyMs: number;
      error?: string;
      created?: number;
      updated?: number;
      closed?: number;
    };
  }>(`/routers/${id}/sync-now`, {
    method: "POST",
    body: JSON.stringify({}),
  }).then((r) => r.data);
}
