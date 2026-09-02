"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CheckCircle2,
  MessageSquare,
  Printer,
  Receipt,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BulkGenerateDialog } from "@/components/billing/bulk-generate-dialog";
import { CreateInvoiceDialog } from "@/components/billing/create-invoice-dialog";
import { PaymentDialog } from "@/components/billing/payment-dialog";
import { ReminderDialog } from "@/components/billing/reminder-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import {
  InvoiceStatusBadge,
  PaymentMethodBadge,
} from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCustomersQuery,
  useDeleteInvoiceMutation,
  useInternetProfilesQuery,
  useInvoicesQuery,
} from "@/lib/api/hooks";
import type { Invoice } from "@/lib/types";
import { useDebounce } from "@/lib/use-debounce";
import { formatDate, formatRupiah, getErrorMessage } from "@/lib/utils";

export default function BillingInvoicesPage() {
  const queryClient = useQueryClient();

  // Filters (via nuqs)
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 350);

  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsString.withDefault("all"),
  );
  const [monthFilter, setMonthFilter] = useQueryState(
    "month",
    parseAsString.withDefault("all"),
  );

  // Pagination (via nuqs)
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(10).withOptions({ history: "replace" }),
  );
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const safePage = Math.max(page, 1);

  // Sync debounced search to URL state
  useEffect(() => {
    if (debouncedSearch !== search) {
      setSearch(debouncedSearch);
      setPage(1);
    }
  }, [debouncedSearch, search, setSearch, setPage]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const invParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: statusFilter,
      month: monthFilter,
      page: safePage,
      limit: safeLimit,
    }),
    [search, statusFilter, monthFilter, safePage, safeLimit],
  );

  const {
    data: invRes,
    isLoading: invoicesLoading,
    refetch: refetchInvoices,
  } = useInvoicesQuery(invParams);

  const { data: custRes } = useCustomersQuery({ limit: 1000 });
  const customers = custRes?.data || [];
  const { data: profRes } = useInternetProfilesQuery();
  const profiles = profRes?.data || [];

  const deleteInvoiceMutation = useDeleteInvoiceMutation();

  const invoices = invRes?.data || [];
  const totalInvoicesCount = invRes?.total || 0;
  const loading = invoicesLoading && !invRes;
  const invoiceTotalPages = Math.ceil(totalInvoicesCount / safeLimit) || 1;

  // Dialog states
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [reminderTarget, setReminderTarget] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteInvoiceMutation.mutateAsync(deleteTarget.id);
      toast.success(`Invoice ${deleteTarget.invoiceNumber} berhasil dihapus.`);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menghapus invoice");
    }
  };

  const handlePaymentSuccess = async () => {
    refetchInvoices();
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Filters Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Cari nomor tagihan, username, nama pelanggan..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            {/* Status & Month Filter */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-40">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Status Tagihan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="unpaid">Belum Bayar</SelectItem>
                    <SelectItem value="paid">Lunas</SelectItem>
                    <SelectItem value="overdue">Jatuh Tempo</SelectItem>
                    <SelectItem value="cancelled">Dibatalkan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-36">
                <Select
                  value={monthFilter}
                  onValueChange={(v) => {
                    setMonthFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Bulan</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {new Date(2026, m - 1, 1).toLocaleDateString("id-ID", {
                          month: "long",
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(search ||
                searchInput ||
                statusFilter !== "all" ||
                monthFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setStatusFilter("all");
                    setMonthFilter("all");
                    setPage(1);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">No. Invoice</th>
                  <th className="py-3 px-4 font-semibold">Pelanggan</th>
                  <th className="py-3 px-4 font-semibold">Paket & Periode</th>
                  <th className="py-3 px-4 font-semibold">Total Tagihan</th>
                  <th className="py-3 px-4 font-semibold">Jatuh Tempo</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Metode</th>
                  <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="p-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <EmptyState
                        icon={Receipt}
                        title="Tidak ada data tagihan"
                        description="Belum ada tagihan yang cocok dengan filter atau kriteria pencarian."
                        actionLabel="Buat Tagihan Baru"
                        onAction={() => setCreateOpen(true)}
                      />
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                        <Link
                          href={`/billing/${inv.id}`}
                          className="hover:underline flex items-center gap-1"
                        >
                          <span>{inv.invoiceNumber}</span>
                          <ArrowUpRight className="h-3 w-3 opacity-60" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {inv.customerFullName || inv.customerUsername}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          @{inv.customerUsername}{" "}
                          {inv.customerPhone ? `• ${inv.customerPhone}` : ""}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {inv.profileName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Bulan {inv.periodMonth}/{inv.periodYear}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {formatRupiah(inv.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="py-3.5 px-4">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="py-3.5 px-4">
                        <PaymentMethodBadge method={inv.paymentMethod} />
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {inv.status !== "paid" && (
                            <Button
                              variant="success"
                              size="xs"
                              onClick={() => setPaymentTarget(inv)}
                              title="Tandai Pembayaran Lunas"
                              className="h-7 px-2.5 text-xs shadow-xs font-medium"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Bayar
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setReminderTarget(inv)}
                            title="Kirim Pengingat WhatsApp"
                            className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 p-0"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                          </Button>

                          <Button
                            asChild
                            variant="ghost"
                            size="xs"
                            className="h-7 w-7 text-slate-600 hover:text-slate-900 p-0"
                            title="Cetak / Detail Invoice"
                          >
                            <Link href={`/billing/${inv.id}`}>
                              <Printer className="h-3.5 w-3.5" />
                            </Link>
                          </Button>

                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => setDeleteTarget(inv)}
                            title="Hapus Invoice"
                            className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-0"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!loading && totalInvoicesCount > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Menampilkan{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min(
                      (safePage - 1) * safeLimit + 1,
                      totalInvoicesCount,
                    )}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min(safePage * safeLimit, totalInvoicesCount)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {totalInvoicesCount}
                  </span>{" "}
                  tagihan
                </span>
                <Select
                  value={String(safeLimit)}
                  onValueChange={(v) => {
                    setLimit(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="h-8 px-3 text-xs"
                >
                  Sebelumnya
                </Button>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Hal {safePage} dari {invoiceTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(invoiceTotalPages, p + 1))
                  }
                  disabled={safePage === invoiceTotalPages}
                  className="h-8 px-3 text-xs"
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {paymentTarget && (
        <PaymentDialog
          invoice={paymentTarget}
          open={Boolean(paymentTarget)}
          onOpenChange={(op: boolean) => !op && setPaymentTarget(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {reminderTarget && (
        <ReminderDialog
          invoice={reminderTarget}
          open={Boolean(reminderTarget)}
          onOpenChange={(op: boolean) => !op && setReminderTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(op: boolean) => !op && setDeleteTarget(null)}
          title={`Hapus Invoice ${deleteTarget.invoiceNumber}?`}
          description="Faktur ini akan dihapus secara permanen dari sistem. Tindakan ini tidak dapat dibatalkan."
          confirmLabel="Hapus Invoice"
          variant="destructive"
          onConfirm={handleDelete}
        />
      )}

      <CreateInvoiceDialog
        customers={customers}
        profiles={profiles}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          refetchInvoices();
          queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
        }}
      />

      <BulkGenerateDialog
        customers={customers}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onSuccess={() => {
          refetchInvoices();
          queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
        }}
      />
    </div>
  );
}
