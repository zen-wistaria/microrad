import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { queryKeys } from "../query-keys";
import {
  connectRouterRadius,
  createRouter,
  deleteRouter,
  disconnectRouterRadius,
  type GetRoutersParams,
  getRouterById,
  getRoutersPaginated,
  pingRouter,
  type RouterPayload,
  syncRouterNow,
  updateRouter,
} from "../routers";

export function useRoutersQuery(params?: GetRoutersParams) {
  return useQuery({
    queryKey: queryKeys.routers.list(params),
    queryFn: () => getRoutersPaginated(params),
    placeholderData: keepPreviousData,
  });
}

export function useRouterNasQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.routers.detail(id),
    queryFn: () => getRouterById(id),
    enabled: !!id,
  });
}

export function useCreateRouterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RouterPayload) => createRouter(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateRouterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<RouterPayload>;
    }) => updateRouter(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.routers.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteRouterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRouter(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function usePingRouterMutation() {
  return useMutation({
    mutationFn: (id: string) => pingRouter(id),
  });
}

export function useSyncRouterMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => syncRouterNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useConnectRadiusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => connectRouterRadius(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.detail(id) });
    },
  });
}

export function useDisconnectRadiusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => disconnectRouterRadius(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.detail(id) });
    },
  });
}
