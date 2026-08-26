import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createProfile,
  deleteProfile,
  type GetProfilesParams,
  getProfileById,
  getProfilesPaginated,
  updateProfile,
} from "../profiles";
import { queryKeys } from "../query-keys";

export function useProfilesQuery(params?: GetProfilesParams) {
  return useQuery({
    queryKey: queryKeys.profiles.list(params),
    queryFn: () => getProfilesPaginated(params),
    placeholderData: keepPreviousData,
  });
}

export function useProfileQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.profiles.detail(id),
    queryFn: () => getProfileById(id),
    enabled: Boolean(id),
  });
}

export function useCreateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
    },
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateProfile>[1];
    }) => updateProfile(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}

export function useDeleteProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
    },
  });
}

// Backward compatibility aliases
export const usePppProfilesQuery = useProfilesQuery;
export const usePppProfileQuery = useProfileQuery;
export const useCreatePppProfileMutation = useCreateProfileMutation;
export const useUpdatePppProfileMutation = useUpdateProfileMutation;
export const useDeletePppProfileMutation = useDeleteProfileMutation;
