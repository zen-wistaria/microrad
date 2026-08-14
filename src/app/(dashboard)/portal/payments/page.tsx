"use client";

import { RefreshCw, Wallet } from "lucide-react";
import { PaymentMethodBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortal } from "@/lib/portal-context";
import { formatDate, formatRupiah } from "@/lib/utils";

export default function PortalPaymentsPage() {
  const { data, loading, refreshing, reload } = usePortal();

  if (loading) {
    return <Skeleton className="h-80 w-full rounded-xl" />;
  }

  const payments = data?.payments ?? [];

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
                  {payments.map((p) => (
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
        </CardContent>
      </Card>
    </div>
  );
}
