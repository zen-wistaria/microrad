"use client";

import { RefreshCw, Wallet } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
import { useMemo } from "react";
import { PaymentMethodBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortal } from "@/lib/portal-context";
import { formatDate, formatRupiah } from "@/lib/utils";

export default function PortalPaymentsPage() {
  const { data, loading, refreshing, reload } = usePortal();

  // Pagination (via nuqs — konsisten saat refresh)
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(10).withOptions({ history: "replace" }),
  );
  const safeLimit = Math.min(Math.max(limit, 1), 50); // maksimal 50

  const payments = data?.payments ?? [];

  const totalPages = Math.ceil(payments.length / safeLimit) || 1;
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const paginatedPayments = useMemo(() => {
    const start = (safePage - 1) * safeLimit;
    return payments.slice(start, start + safeLimit);
  }, [payments, safePage, safeLimit]);

  if (loading) {
    return <Skeleton className="h-80 w-full rounded-xl" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Pembayaran
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Riwayat pembayaran Anda
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={reload}
          disabled={refreshing}
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Muat Ulang
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Riwayat Pembayaran
          </CardTitle>
          <CardDescription>
            {payments.length > 0
              ? `${payments.length} pembayaran tercatat.`
              : "Belum ada pembayaran tercatat atas nama Anda."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Belum ada data pembayaran.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="pb-2 pr-4 font-medium">Referensi</th>
                    <th className="pb-2 pr-4 font-medium">Tanggal</th>
                    <th className="pb-2 pr-4 font-medium">Metode</th>
                    <th className="pb-2 font-medium">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayments.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <td className="py-2.5 pr-4">
                        <p className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {p.paymentReference || p.id}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {p.invoiceNumber}
                        </p>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-slate-600 dark:text-slate-300">
                        {formatDate(p.paidAt)}
                      </td>
                      <td className="py-2.5 pr-4">
                        <PaymentMethodBadge method={p.paymentMethod} />
                      </td>
                      <td className="py-2.5 font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {payments.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Menampilkan{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min((safePage - 1) * safeLimit + 1, payments.length)}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min(safePage * safeLimit, payments.length)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {payments.length}
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
                  Hal {safePage} dari {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
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
