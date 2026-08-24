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

export async function getSessionsPaginated(
  params: GetSessionsParams = {},
): Promise<{ data: Session[]; total: number }> {
  return paginated<Session>("/sessions", {
    activeOnly: params.activeOnly ? "true" : undefined,
    customerId: params.customerId,
    nasId: params.nasId,
    search: params.search,
    router: params.router,
    year: params.year,
    month: params.month,
    page: params.page ?? 1,
    limit: params.limit ?? 10,
  });
}

async function fetchSessions(
  params: GetSessionsParams = {},
): Promise<Session[]> {
  const res = await getSessionsPaginated({
    ...params,
    limit: params.limit ?? 50,
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
  params: {
    year?: number;
    month?: number;
    page?: number;
    limit?: number;
  } = {},
): Promise<{ data: Session[]; total: number }> {
  return getSessionsPaginated({
    customerId,
    year: params.year,
    month: params.month,
    page: params.page ?? 1,
    limit: params.limit ?? 10,
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

export async function bulkDisconnectSessions(
  sessionIds: string[],
): Promise<{ success: boolean; message: string; count: number }> {
  return apiFetch<{ success: boolean; message: string; count: number }>(
    "/sessions/bulk-disconnect",
    {
      method: "POST",
      body: JSON.stringify({ sessionIds }),
    },
  );
}
