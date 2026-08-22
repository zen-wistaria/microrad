import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPppProfile,
  deletePppProfile,
  getPppProfileById,
  getPppProfiles,
  updatePppProfile,
} from "../ppp-profiles";
import { queryKeys } from "../query-keys";

export function usePppProfilesQuery() {
  return useQuery({
    queryKey: queryKeys.pppProfiles.list(),
    queryFn: () => getPppProfiles(),
  });
}

export function usePppProfileQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.pppProfiles.detail(id),
    queryFn: () => getPppProfileById(id),
    enabled: Boolean(id),
  });
}

export function useCreatePppProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPppProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pppProfiles.all });
    },
  });
}

export function useUpdatePppProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updatePppProfile>[1];
    }) => updatePppProfile(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pppProfiles.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.pppProfiles.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}

export function useDeletePppProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePppProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.pppProfiles.all });
    },
  });
}
