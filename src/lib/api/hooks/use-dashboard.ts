import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "../dashboard";
import { queryKeys } from "../query-keys";

export function useDashboardQuery() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: getDashboardStats,
  });
}
