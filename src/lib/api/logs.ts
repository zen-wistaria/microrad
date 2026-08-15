import { mockDb } from "../mock/db";
import type { GlobalLogEntry } from "../mock/global-logs";

const delay = (ms = 150) => new Promise((resolve) => setTimeout(resolve, ms));

export interface GlobalLogFilter {
  search?: string;
  source?: string;
  from?: string;
  to?: string;
}

/** Ambil log login global dengan filter (pencarian nama, sumber, rentang waktu) */
export async function getGlobalLogs(
  filter?: GlobalLogFilter,
): Promise<GlobalLogEntry[]> {
  await delay();
  return mockDb.getGlobalLogs(filter);
}
