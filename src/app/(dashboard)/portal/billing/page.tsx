"use client";

import { Receipt, RefreshCw } from "lucide-react";
import { InvoiceStatusBadge } from "@/components/common/status-badge";
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

export default function PortalBillingPage() {
  const { data, loading, refreshing, reload } = usePortal();

  if (loading) {
    return <Skeleton className="h-80 w-full rounded-xl" />;
  }

  const invoices = data?.invoices ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Tagihan
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Riwayat tagihan internet Anda
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
            <Receipt className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Riwayat Tagihan
          </CardTitle>
          <CardDescription>
            {invoices.length > 0
              ? `${invoices.length} tagihan tercatat atas nama Anda.`
              : "Belum ada tagihan tercatat atas nama Anda."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Belum ada data tagihan.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="pb-2 pr-4 font-medium">No. Invoice</th>
                    <th className="pb-2 pr-4 font-medium">Periode</th>
                    <th className="pb-2 pr-4 font-medium">Jatuh Tempo</th>
                    <th className="pb-2 pr-4 font-medium">Total</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <td className="py-2.5 pr-4">
                        <p className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {inv.invoiceNumber}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {inv.profileName}
                        </p>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-slate-600 dark:text-slate-300">
                        {String(inv.periodMonth).padStart(2, "0")}/
                        {inv.periodYear}
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-slate-600 dark:text-slate-300">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="py-2.5 pr-4 font-semibold text-slate-900 dark:text-slate-100">
                        {formatRupiah(inv.totalAmount)}
                      </td>
                      <td className="py-2.5">
                        <InvoiceStatusBadge status={inv.status} />
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
