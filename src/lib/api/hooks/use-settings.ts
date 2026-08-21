import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompanyProfile } from "@/lib/types";
import { apiFetch } from "../client";
import { queryKeys } from "../query-keys";
import {
  getCompanyProfile,
  getWaTemplate,
  saveWaTemplate,
  updateCompanyProfile,
} from "../settings";

export function useCompanyProfileQuery() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: getCompanyProfile,
  });
}

export function useWaTemplateQuery() {
  return useQuery({
    queryKey: ["settings", "wa-template"],
    queryFn: getWaTemplate,
  });
}

export function useUpdateCompanyProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<CompanyProfile>) =>
      updateCompanyProfile(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });
}

export function useSaveWaTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (template: string) => saveWaTemplate(template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "wa-template"] });
    },
  });
}

export function useReloadRadiusMutation() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean; message: string }>("/radius/reload", {
        method: "POST",
        body: JSON.stringify({}),
      }),
  });
}
