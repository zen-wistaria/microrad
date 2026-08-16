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

export async function createRouter(
  data: Omit<NasRouter, "id" | "activeSessionCount">,
): Promise<NasRouter> {
  return apiFetch<{ data: NasRouter }>("/routers", {
    method: "POST",
    body: JSON.stringify(data),
  }).then((r) => r.data);
}

export async function updateRouter(
  id: string,
  updates: Partial<NasRouter>,
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

export async function pingRouter(
  id: string,
): Promise<{ status: "online" | "offline"; latencyMs: number }> {
  return apiFetch<{
    data: { status: "online" | "offline"; latencyMs: number };
  }>(`/routers/${id}/ping`, { method: "POST", body: JSON.stringify({}) }).then(
    (r) => r.data,
  );
}
