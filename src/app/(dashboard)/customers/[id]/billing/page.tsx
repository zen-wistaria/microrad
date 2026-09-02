"use client";

import Link from "next/link";
import { parseAsInteger, useQueryState } from "nuqs";
import { useMemo } from "react";
import {
  InvoiceStatusBadge,
  PaymentMethodBadge,
} from "@/components/common/status-badge";
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
import { useInvoicesQuery } from "@/lib/api/hooks";
import { formatDate, formatRupiah } from "@/lib/utils";
import { useCustomerDetail } from "../customer-detail-context";

export default function CustomerBillingPage() {
  const { customerId, customer } = useCustomerDetail();

  // Pagination (via nuqs)
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(10).withOptions({ history: "replace" }),
  );
  const safeLimit = Math.min(Math.max(limit, 1), 50);

  const invFilter = useMemo(
    () => ({
      customerId,
      page,
      limit: safeLimit,
    }),
    [customerId, page, safeLimit],
  );

  const { data: invoicesRes, isLoading } = useInvoicesQuery(invFilter);
  const invoices = invoicesRes?.data || [];
  const invoiceTotalCount = invoicesRes?.total ?? 0;

  const invoiceTotalPages = Math.ceil(invoiceTotalCount / safeLimit) || 1;
  const invoiceSafePage = Math.min(Math.max(page, 1), invoiceTotalPages);

  return (
    <div className="space-y-4 pt-2">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                Riwayat Tagihan & Faktur Pelanggan
              </CardTitle>
              <CardDescription>
                Daftar faktur tagihan bulanan PPPoE untuk akun{" "}
                {customer?.username}.
              </CardDescription>
            </div>
            {customer && (
              <Button asChild size="xs" variant="outline">
                <Link
                  href={`/billing/invoices?search=${encodeURIComponent(customer.username)}`}
                >
                  Buka di Menu Billing
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 text-slate-500 border-y border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">No. Invoice</th>
                  <th className="py-2.5 px-4 font-semibold">Paket & Periode</th>
                  <th className="py-2.5 px-4 font-semibold">Total Tagihan</th>
                  <th className="py-2.5 px-4 font-semibold">Jatuh Tempo</th>
                  <th className="py-2.5 px-4 font-semibold">Status</th>
                  <th className="py-2.5 px-4 font-semibold">Metode</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Memuat data tagihan...
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Belum ada tagihan yang diterbitkan untuk pelanggan ini.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                        <Link
                          href={`/billing/${inv.id}`}
                          className="hover:underline"
                        >
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {inv.profileName}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Bulan {inv.periodMonth}/{inv.periodYear}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {formatRupiah(inv.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="py-3 px-4">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="py-3 px-4">
                        <PaymentMethodBadge method={inv.paymentMethod} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button asChild size="xs" variant="ghost">
                          <Link href={`/billing/${inv.id}`}>Detail</Link>
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {invoiceTotalCount > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Menampilkan{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {(invoiceSafePage - 1) * safeLimit + 1}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min(invoiceSafePage * safeLimit, invoiceTotalCount)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {invoiceTotalCount}
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
                  disabled={invoiceSafePage === 1}
                  className="h-8 px-3 text-xs"
                >
                  Sebelumnya
                </Button>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Hal {invoiceSafePage} dari {invoiceTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(invoiceTotalPages, p + 1))
                  }
                  disabled={invoiceSafePage === invoiceTotalPages}
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
