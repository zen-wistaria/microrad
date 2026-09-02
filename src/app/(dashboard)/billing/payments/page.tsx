"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { PaymentMethodBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePaymentsQuery } from "@/lib/api/hooks";
import { useDebounce } from "@/lib/use-debounce";
import { formatDate, formatRupiah } from "@/lib/utils";

export default function BillingPaymentsPage() {
  // Filters (via nuqs)
  const [paymentSearch, setPaymentSearch] = useQueryState(
    "paysearch",
    parseAsString.withDefault(""),
  );
  const [paymentSearchInput, setPaymentSearchInput] = useState(paymentSearch);
  const debouncedPaymentSearch = useDebounce(paymentSearchInput, 350);

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
    if (debouncedPaymentSearch !== paymentSearch) {
      setPaymentSearch(debouncedPaymentSearch);
      setPage(1);
    }
  }, [debouncedPaymentSearch, paymentSearch, setPaymentSearch, setPage]);

  useEffect(() => {
    setPaymentSearchInput(paymentSearch);
  }, [paymentSearch]);

  const payParams = useMemo(
    () => ({
      paysearch: paymentSearch.trim() || undefined,
      page: safePage,
      limit: safeLimit,
    }),
    [paymentSearch, safePage, safeLimit],
  );

  const { data: payRes, isLoading: paymentsLoading } =
    usePaymentsQuery(payParams);

  const payments = payRes?.data || [];
  const totalPaymentsCount = payRes?.total || 0;
  const paymentTotalPages = Math.ceil(totalPaymentsCount / safeLimit) || 1;

  return (
    <div className="space-y-4 pt-2">
      {/* Filters Bar — Pembayaran */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Cari referensi, no. invoice, nama pelanggan..."
                value={paymentSearchInput}
                onChange={(e) => setPaymentSearchInput(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            {(paymentSearch || paymentSearchInput) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPaymentSearchInput("");
                  setPaymentSearch("");
                  setPage(1);
                }}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Riwayat Transaksi & Pembayaran Masuk
          </CardTitle>
          <CardDescription className="text-xs">
            Log real-time seluruh pembayaran invoice yang berhasil diverifikasi.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">
                    ID Transaksi / Ref
                  </th>
                  <th className="py-3 px-4 font-semibold">No. Invoice</th>
                  <th className="py-3 px-4 font-semibold">Pelanggan</th>
                  <th className="py-3 px-4 font-semibold">Nominal Masuk</th>
                  <th className="py-3 px-4 font-semibold">Metode Pembayaran</th>
                  <th className="py-3 px-4 font-semibold">Waktu Pembayaran</th>
                  <th className="py-3 px-4 font-semibold">Diterima Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paymentsLoading && !payRes ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="p-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      {paymentSearch
                        ? "Tidak ada pembayaran yang cocok dengan pencarian."
                        : "Belum ada data transaksi pembayaran."}
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {p.paymentReference || p.id}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-blue-600 dark:text-blue-400">
                        <Link
                          href={`/billing/${p.invoiceId}`}
                          className="hover:underline"
                        >
                          {p.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {p.customerName}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(p.amount)}
                      </td>
                      <td className="py-3.5 px-4">
                        <PaymentMethodBadge method={p.paymentMethod} />
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {formatDate(p.paidAt)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        {p.receivedBy}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPaymentsCount > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Menampilkan{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min(
                      (safePage - 1) * safeLimit + 1,
                      totalPaymentsCount,
                    )}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min(safePage * safeLimit, totalPaymentsCount)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {totalPaymentsCount}
                  </span>{" "}
                  pembayaran
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
                  Hal {safePage} dari {paymentTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(paymentTotalPages, p + 1))
                  }
                  disabled={safePage === paymentTotalPages}
                  className="h-8 px-3 text-xs"
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
