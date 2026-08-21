import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type GlobalLogFilter, getGlobalLogsPaginated } from "../logs";
import { queryKeys } from "../query-keys";

export function useLogsQuery(filter?: GlobalLogFilter) {
  return useQuery({
    queryKey: queryKeys.logs.list(filter),
    queryFn: () => getGlobalLogsPaginated(filter),
    placeholderData: keepPreviousData,
  });
}
