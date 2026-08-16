import type { GlobalLogEntry } from "@/lib/mock/global-logs";
import { paginated } from "./client";

export interface GlobalLogFilter {
  search?: string;
  source?: string;
  from?: string;
  to?: string;
}

export async function getGlobalLogs(
  filter?: GlobalLogFilter,
): Promise<GlobalLogEntry[]> {
  const res = await paginated<GlobalLogEntry>("/logs", {
    search: filter?.search,
    source: filter?.source,
    from: filter?.from,
    to: filter?.to,
    page: 1,
    limit: 1000,
  });
  return res.data;
}
