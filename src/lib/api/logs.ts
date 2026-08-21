import type { GlobalLogEntry } from "@/lib/types";
import { paginated } from "./client";

export interface GlobalLogFilter {
  search?: string;
  source?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export async function getGlobalLogsPaginated(
  filter?: GlobalLogFilter,
): Promise<{ data: GlobalLogEntry[]; total: number }> {
  return paginated<GlobalLogEntry>("/logs", {
    search: filter?.search,
    source: filter?.source,
    from: filter?.from,
    to: filter?.to,
    page: filter?.page ?? 1,
    limit: filter?.limit ?? 10,
  });
}

export async function getGlobalLogs(
  filter?: GlobalLogFilter,
): Promise<GlobalLogEntry[]> {
  const res = await getGlobalLogsPaginated({
    ...filter,
    page: filter?.page ?? 1,
    limit: filter?.limit ?? 1000,
  });
  return res.data;
}
