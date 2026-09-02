"use client";

import { parseAsInteger, useQueryState } from "nuqs";
import { useMemo } from "react";
import { CustomerMonthlyUsageChart } from "@/components/charts/customer-monthly-usage-chart";
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
import { formatBytes } from "@/lib/utils";

const YEARS = [2026, 2025, 2024, 2023];

export default function PortalMonthlyUsagePage() {
  const { data, loading: portalLoading } = usePortal();

  const [selectedYear, setSelectedYear] = useQueryState(
    "year",
    parseAsInteger.withDefault(new Date().getFullYear()),
  );

  const allMonthly = data?.monthlyUsage ?? [];
  const monthly = useMemo(() => {
    return selectedYear > 0
      ? allMonthly.filter((m) => m.month.startsWith(`${selectedYear}-`))
      : allMonthly;
  }, [allMonthly, selectedYear]);

  const totalYearlyDown = monthly.reduce((acc, m) => acc + m.downloadBytes, 0);
  const totalYearlyUp = monthly.reduce((acc, m) => acc + m.uploadBytes, 0);
  const totalYearly = monthly.reduce((acc, m) => acc + m.totalBytes, 0);
  const totalSessions = monthly.reduce((acc, m) => acc + m.sessionsCount, 0);

  return (
    <div className="space-y-6 pt-2">
      {/* Akumulasi 1 tahun (tahun terpilih pada filter di bawah) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500">
              Akumulasi {selectedYear} (Download)
            </span>
            <p className="mt-1 text-xl font-bold text-blue-900 dark:text-blue-100">
              {formatBytes(totalYearlyDown)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500">
              Akumulasi {selectedYear} (Upload)
            </span>
            <p className="mt-1 text-xl font-bold text-indigo-900 dark:text-indigo-100">
              {formatBytes(totalYearlyUp)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500">
              Total Akumulasi {selectedYear}
            </span>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              {formatBytes(totalYearly)}
            </p>
            <p className="text-[11px] text-slate-400">Sesi: {totalSessions}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                Grafik Pemakaian Per Bulan
              </CardTitle>
              <CardDescription>
                Total download vs upload per bulan pada tahun {selectedYear}.
              </CardDescription>
            </div>
            {/* Filter per tahun */}
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger className="w-32 h-9">
                <SelectValue placeholder="Pilih Tahun" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {portalLoading ? (
            <Skeleton className="h-70 w-full rounded-xl" />
          ) : monthly.length > 0 ? (
            <CustomerMonthlyUsageChart data={monthly} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              Belum ada data pemakaian bulanan.
            </p>
          )}
        </CardContent>
      </Card>

      {!portalLoading && monthly.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rincian Per Bulan ({selectedYear})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="pb-2 pr-4 font-medium">Bulan</th>
                    <th className="pb-2 pr-4 font-medium">Download</th>
                    <th className="pb-2 pr-4 font-medium">Upload</th>
                    <th className="pb-2 pr-4 font-medium">Total</th>
                    <th className="pb-2 font-medium">Sesi</th>
                  </tr>
                </thead>
                <tbody>
                  {[...monthly].reverse().map((m) => (
                    <tr
                      key={m.month}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <td className="py-2 pr-4 text-xs font-medium text-slate-900 dark:text-slate-100">
                        {m.label}
                      </td>
                      <td className="py-2 pr-4 text-xs text-blue-600 dark:text-blue-400">
                        {formatBytes(m.downloadBytes)}
                      </td>
                      <td className="py-2 pr-4 text-xs text-indigo-600 dark:text-indigo-400">
                        {formatBytes(m.uploadBytes)}
                      </td>
                      <td className="py-2 pr-4 text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {formatBytes(m.totalBytes)}
                      </td>
                      <td className="py-2 text-xs text-slate-600 dark:text-slate-300">
                        {m.sessionsCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
