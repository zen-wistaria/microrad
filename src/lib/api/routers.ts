import { mockDb } from "../mock/db";
import type { NasRouter } from "../types";

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getRouters(): Promise<NasRouter[]> {
  await delay();
  return mockDb.getRouters();
}

export async function getRouterById(id: string): Promise<NasRouter | null> {
  await delay();
  const router = mockDb.getRouterById(id);
  return router || null;
}

export async function createRouter(
  data: Omit<NasRouter, "id" | "activeSessionCount">,
): Promise<NasRouter> {
  await delay();
  return mockDb.createRouter(data);
}

export async function updateRouter(
  id: string,
  updates: Partial<NasRouter>,
): Promise<NasRouter> {
  await delay();
  const updated = mockDb.updateRouter(id, updates);
  if (!updated) {
    throw new Error("Router NAS tidak ditemukan.");
  }
  return updated;
}

export async function deleteRouter(id: string): Promise<{ success: boolean }> {
  await delay();
  const result = mockDb.deleteRouter(id);
  if (!result.success) {
    throw new Error(result.error || "Gagal menghapus router NAS.");
  }
  return { success: true };
}

export async function pingRouter(
  id: string,
): Promise<{ status: "online" | "offline"; latencyMs: number }> {
  await delay(300);
  const router = mockDb.getRouterById(id);
  if (!router) throw new Error("Router tidak ditemukan");

  const isOnline = router.status !== "offline";
  const latency = isOnline ? Math.floor(Math.random() * 15) + 2 : 0;
  return {
    status: isOnline ? "online" : "offline",
    latencyMs: latency,
  };
}
