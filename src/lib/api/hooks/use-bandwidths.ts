import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createBandwidth,
  deleteBandwidth,
  type GetBandwidthsParams,
  getBandwidthById,
  getBandwidthsPaginated,
  updateBandwidth,
} from "../bandwidths";
import { queryKeys } from "../query-keys";

export function useBandwidthsQuery(params?: GetBandwidthsParams) {
  return useQuery({
    queryKey: queryKeys.bandwidths.list(params),
    queryFn: () => getBandwidthsPaginated(params),
    placeholderData: keepPreviousData,
  });
}

export function useBandwidthQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.bandwidths.detail(id),
    queryFn: () => getBandwidthById(id),
    enabled: Boolean(id),
  });
}

export function useCreateBandwidthMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBandwidth,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bandwidths.all });
    },
  });
}

export function useUpdateBandwidthMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateBandwidth>[1];
    }) => updateBandwidth(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bandwidths.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.bandwidths.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.pppProfiles.all });
    },
  });
}

export function useDeleteBandwidthMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBandwidth(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bandwidths.all });
    },
  });
}
