import { useQuery } from "@tanstack/react-query";
import { getCustomerPortalData } from "../customer-portal";
import { queryKeys } from "../query-keys";

export function usePortalMeQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.portal.me,
    queryFn: getCustomerPortalData,
    enabled,
  });
}
