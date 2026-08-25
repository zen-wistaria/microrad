import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createInternetProfile,
  deleteInternetProfile,
  type GetInternetProfilesParams,
  getInternetProfileById,
  getInternetProfilesPaginated,
  updateInternetProfile,
} from "../internet-profiles";
import { queryKeys } from "../query-keys";

export function useInternetProfilesQuery(params?: GetInternetProfilesParams) {
  return useQuery({
    queryKey: queryKeys.internetProfiles.list(params),
    queryFn: () => getInternetProfilesPaginated(params),
    placeholderData: keepPreviousData,
  });
}

export function useInternetProfileQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.internetProfiles.detail(id),
    queryFn: () => getInternetProfileById(id),
    enabled: Boolean(id),
  });
}

export function useCreateInternetProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createInternetProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.internetProfiles.all,
      });
    },
  });
}

export function useUpdateInternetProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateInternetProfile>[1];
    }) => updateInternetProfile(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.internetProfiles.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.internetProfiles.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}

export function useDeleteInternetProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInternetProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.internetProfiles.all,
      });
    },
  });
}
