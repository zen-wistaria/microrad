import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  disconnectSession,
  type GetSessionsParams,
  getSessionsPaginated,
} from "../sessions";

export function useSessionsQuery(params: GetSessionsParams = {}) {
  return useQuery({
    queryKey: queryKeys.sessions.list(params),
    queryFn: () => getSessionsPaginated(params),
    placeholderData: keepPreviousData,
  });
}

export function useDisconnectSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      cause = "Admin-Reset",
    }: {
      sessionId: string;
      cause?: string;
    }) => disconnectSession(sessionId, cause),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}
