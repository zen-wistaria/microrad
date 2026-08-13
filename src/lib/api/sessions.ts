import { mockDb } from "../mock/db";
import type { Session } from "../types";

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export interface GetSessionsParams {
  activeOnly?: boolean;
  customerId?: string;
  nasId?: string;
  search?: string;
}

export async function getSessions(
  params?: GetSessionsParams,
): Promise<Session[]> {
  await delay();
  return mockDb.getSessions(params);
}

export async function getActiveSessions(
  params?: Omit<GetSessionsParams, "activeOnly">,
): Promise<Session[]> {
  await delay();
  return mockDb.getSessions({ ...params, activeOnly: true });
}

export async function getCustomerSessions(
  customerId: string,
): Promise<Session[]> {
  await delay();
  return mockDb.getSessions({ customerId });
}

export async function getCustomerActiveSession(
  customerId: string,
): Promise<Session | null> {
  await delay();
  const session = mockDb.getActiveSessionForCustomer(customerId);
  return session || null;
}

export async function disconnectSession(
  sessionId: string,
  cause = "Admin-Reset",
): Promise<{ success: boolean }> {
  await delay(200);
  const ok = mockDb.disconnectSession(sessionId, cause);
  if (!ok) {
    throw new Error("Gagal memutuskan sesi PPPoE atau sesi sudah berakhir.");
  }
  return { success: true };
}
