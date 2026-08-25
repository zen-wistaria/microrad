import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createProfileGroup,
  deleteProfileGroup,
  type GetProfileGroupsParams,
  getProfileGroupById,
  getProfileGroupsPaginated,
  updateProfileGroup,
} from "../profile-groups";
import { queryKeys } from "../query-keys";

export function useProfileGroupsQuery(params?: GetProfileGroupsParams) {
  return useQuery({
    queryKey: queryKeys.profileGroups.list(params),
    queryFn: () => getProfileGroupsPaginated(params),
    placeholderData: keepPreviousData,
  });
}

export function useProfileGroupQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.profileGroups.detail(id),
    queryFn: () => getProfileGroupById(id),
    enabled: Boolean(id),
  });
}

export function useCreateProfileGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProfileGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profileGroups.all });
    },
  });
}

export function useUpdateProfileGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof updateProfileGroup>[1];
    }) => updateProfileGroup(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profileGroups.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.profileGroups.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.pppProfiles.all });
    },
  });
}

export function useDeleteProfileGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProfileGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profileGroups.all });
    },
  });
}
