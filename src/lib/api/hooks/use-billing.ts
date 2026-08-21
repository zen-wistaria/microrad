import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { Invoice, PaymentMethod } from "@/lib/types";
import {
  bulkGenerateInvoices,
  type CreateInvoiceInput,
  createInvoiceForCustomer,
  deleteInvoice,
  type GetInvoicesParams,
  getBillingSummary,
  getInvoiceById,
  getInvoicesPaginated,
  getPaymentsPaginated,
  markInvoiceAsPaid,
  sendInvoiceReminder,
  updateInvoice,
} from "../billing";
import { apiFetch } from "../client";
import { queryKeys } from "../query-keys";

export function useInvoicesQuery(params?: GetInvoicesParams) {
  return useQuery({
    queryKey: queryKeys.billing.invoices(params),
    queryFn: () => getInvoicesPaginated(params),
    placeholderData: keepPreviousData,
  });
}

export function usePaymentsQuery(params?: {
  paysearch?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["billing", "payments", params],
    queryFn: () => getPaymentsPaginated(params),
    placeholderData: keepPreviousData,
  });
}

export function useInvoiceDetailQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.billing.invoiceDetail(id),
    queryFn: () => getInvoiceById(id),
    enabled: !!id,
  });
}

export function useBillingSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.billing.summary,
    queryFn: getBillingSummary,
  });
}

export function useBillingMonthsQuery() {
  return useQuery({
    queryKey: queryKeys.billing.months,
    queryFn: () =>
      apiFetch<{ data: { month: number; year: number; label: string }[] }>(
        "/billing/months",
      ).then((r) => r.data),
  });
}

export function useCreateInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateInvoiceInput) => createInvoiceForCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}

export function useUpdateInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Invoice> }) =>
      updateInvoice(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.billing.invoiceDetail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}

export function useDeleteInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function usePayInvoiceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      paymentData,
    }: {
      id: string;
      paymentData: {
        paymentMethod: PaymentMethod;
        paymentReference?: string;
        paidAt?: string;
        notes?: string;
      };
    }) => markInvoiceAsPaid(id, paymentData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.billing.invoiceDetail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}

export function useBulkGenerateInvoicesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      bulkGenerateInvoices(month, year),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
  });
}

export function useSendReminderMutation() {
  return useMutation({
    mutationFn: (id: string) => sendInvoiceReminder(id),
  });
}
