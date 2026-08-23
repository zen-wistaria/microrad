import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Customer } from "@/lib/types";
import {
  type BulkCustomerActionType,
  bulkCustomerAction,
  createCustomer,
  deleteCustomer,
  disconnectCustomer,
  type GetCustomersParams,
  getCustomerById,
  getCustomersPaginated,
  updateCustomer,
} from "../customers";
import { getCustomerMonthlyUsage, getCustomerUsageHistory } from "../dashboard";
import { queryKeys } from "../query-keys";
import { getCustomerActiveSession, getCustomerSessions } from "../sessions";

export function useCustomersQuery(params?: GetCustomersParams) {
  return useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () => getCustomersPaginated(params),
    placeholderData: keepPreviousData,
  });
}

export function useCustomerQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => getCustomerById(id),
    enabled: !!id,
  });
}

export function useCustomerActiveSessionQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.customers.activeSession(id),
    queryFn: () => getCustomerActiveSession(id),
    enabled: !!id,
  });
}

export function useCustomerSessionsQuery(
  id: string,
  filter?: { year?: number; month?: number },
) {
  return useQuery({
    queryKey: queryKeys.customers.sessions(id, filter),
    queryFn: () => getCustomerSessions(id, filter),
    enabled: !!id,
  });
}

export function useCustomerUsageHistoryQuery(
  id: string,
  filter?: { year?: number; month?: number },
) {
  return useQuery({
    queryKey: queryKeys.customers.usageHistory(id, filter),
    queryFn: () => getCustomerUsageHistory(id, filter),
    enabled: !!id,
  });
}

export function useCustomerMonthlyUsageQuery(id: string, year: number) {
  return useQuery({
    queryKey: queryKeys.customers.monthlyUsage(id, year),
    queryFn: () => getCustomerMonthlyUsage(id, year),
    enabled: !!id,
  });
}

export function useCreateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      data: Partial<Omit<Customer, "id" | "createdAt" | "updatedAt">>,
    ) => createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
    },
  });
}

export function useUpdateCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Customer> }) =>
      updateCustomer(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
    },
  });
}

export function useDeleteCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
    },
  });
}

export function useDisconnectCustomerMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => disconnectCustomer(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.sessions(id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.activeSession(id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useBulkCustomerActionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      customerIds,
    }: {
      action: BulkCustomerActionType;
      customerIds: string[];
    }) => bulkCustomerAction(action, customerIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.sessions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.routers.all });
    },
  });
}
