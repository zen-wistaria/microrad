import type { Session } from "@/lib/types";
import { apiFetch, paginated } from "./client";

export interface GetSessionsParams {
  activeOnly?: boolean;
  customerId?: string;
  nasId?: string;
  search?: string;
  year?: number;
  month?: number;
  page?: number;
  limit?: number;
  router?: string;
}

async function fetchSessions(
  params: GetSessionsParams = {},
): Promise<Session[]> {
  const res = await paginated<Session>("/sessions", {
    activeOnly: params.activeOnly ? "true" : undefined,
    customerId: params.customerId,
    nasId: params.nasId,
    search: params.search,
    router: params.router,
    year: params.year,
    month: params.month,
    page: params.page ?? 1,
    limit: params.limit ?? 1000,
  });
  return res.data;
}

export async function getSessions(
  params?: GetSessionsParams,
): Promise<Session[]> {
  return fetchSessions(params);
}

/** Sesi PPPoE live dari RouterOS (sync mikrotik) — idempotent. */
export async function getSessionByExtKey(
  nasId: string,
  extKey: string,
): Promise<Session | null> {
  const sessions = await fetchSessions({ nasId, limit: 1000 });
  return sessions.find((s) => s.extKey === extKey) ?? null;
}

export async function getActiveSessions(
  params?: Omit<GetSessionsParams, "activeOnly">,
): Promise<Session[]> {
  return fetchSessions({ ...params, activeOnly: true });
}

export async function getCustomerSessions(
  customerId: string,
  params: { year?: number; month?: number } = {},
): Promise<Session[]> {
  return fetchSessions({
    customerId,
    year: params.year,
    month: params.month,
    limit: 1000,
  });
}

export async function getCustomerActiveSession(
  customerId: string,
): Promise<Session | null> {
  const sessions = await fetchSessions({
    customerId,
    activeOnly: true,
    limit: 1,
  });
  return sessions[0] ?? null;
}

export async function disconnectSession(
  sessionId: string,
  cause = "Admin-Reset",
): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/sessions/${sessionId}/disconnect`, {
    method: "POST",
    body: JSON.stringify({ cause }),
  });
}
