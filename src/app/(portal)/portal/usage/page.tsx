"use client";

import { ArrowUp, CalendarDays, RefreshCw } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { Suspense, useEffect, useState } from "react";
import { CustomerMonthlyUsageChart } from "@/components/charts/customer-monthly-usage-chart";
import { CustomerUsageChart } from "@/components/charts/customer-usage-chart";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortal } from "@/lib/portal-context";
import type { CustomerDailyUsage, CustomerMonthlyUsage } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

// Deret tahun (mis. 2023–2026) untuk filter "Per Tahun"
const YEARS = (() => {
  const cur = new Date().getFullYear();
  const arr: number[] = [];
  for (let y = cur; y >= cur - 3; y--) arr.push(y);
  return arr;
})();

function PortalUsageContent() {
  const { data, loading, refreshing, reload } = usePortal();

  const [daily, setDaily] = useState<CustomerDailyUsage[]>([]);
  const [monthly, setMonthly] = useState<CustomerMonthlyUsage[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useQueryState(
    "year",
    parseAsInteger.withDefault(new Date().getFullYear()),
  );
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("daily"),
  );

  useEffect(() => {
    if (data) setDaily(data.usageHistory);
  }, [data]);

  // Pemakaian per bulan — dari data portal (monthlyUsage, 12 bulan berjalan).
  // Filter tahun terpilih dilakukan di client.
  useEffect(() => {
    if (!data) return;
    setMonthlyLoading(true);
    const monthly = data.monthlyUsage ?? [];
    const filtered =
      selectedYear > 0
        ? monthly.filter((m) => m.month.startsWith(`${selectedYear}-`))
        : monthly;
    setMonthly(filtered);
    setMonthlyLoading(false);
  }, [data, selectedYear]);

  // Akumulasi pemakaian bulan ini (bulan berjalan) dari data bulanan tahun
  // terpilih; fallback ke baris bulan berjalan dari 30 hari terakhir.
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const currentMonthEntry = monthly.find((m) => m.month === currentMonthKey);
  const currentMonth = currentMonthEntry ?? {
    downloadBytes: daily.reduce((acc, d) => acc + d.downloadBytes, 0),
    uploadBytes: daily.reduce((acc, d) => acc + d.uploadBytes, 0),
    totalBytes: daily.reduce((acc, d) => acc + d.totalBytes, 0),
    sessionsCount: daily.reduce((acc, d) => acc + d.sessionsCount, 0),
  };
  const currentMonthLabel =
    currentMonthEntry?.label ??
    new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  if (loading) {
    return <Skeleton className="h-80 w-full rounded-xl" />;
  }

  // Akumulasi per tahun terpilih (filter tahun) — dipakai di mini cards
  const totalYearly = monthly.reduce((acc, m) => acc + m.totalBytes, 0);
  const totalYearlyDown = monthly.reduce((acc, m) => acc + m.downloadBytes, 0);
  const totalYearlyUp = monthly.reduce((acc, m) => acc + m.uploadBytes, 0);
  const totalSessions = monthly.reduce((acc, m) => acc + m.sessionsCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Pemakaian Internet
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {data?.customer.username
              ? `Pemakaian untuk ${data.customer.fullName || data.customer.username}`
              : "Detail pemakaian internet Anda"}
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

      {/* Summary Mini Cards — 30 hari + pemakaian bulan berjalan */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-slate-500">
              30 Hari Terakhir
            </p>
            <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-slate-100">
              {formatBytes(daily.reduce((acc, d) => acc + d.totalBytes, 0))}
            </p>
            <p className="text-[11px] text-slate-400">Total pemakaian</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-slate-500">
              Pemakaian Bulan Ini (Download)
            </p>
            <p className="mt-1.5 text-lg font-bold text-blue-900 dark:text-blue-100">
              {formatBytes(currentMonth.downloadBytes)}
            </p>
            <p className="text-[11px] text-slate-400">Akumulasi download</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-slate-500">
              Pemakaian Bulan Ini (Upload)
            </p>
            <p className="mt-1.5 text-lg font-bold text-indigo-900 dark:text-indigo-100">
              {formatBytes(currentMonth.uploadBytes)}
            </p>
            <p className="text-[11px] text-slate-400">Akumulasi upload</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-slate-500">
              Total Pemakaian Bulan Ini ({currentMonthLabel})
            </p>
            <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-slate-100">
              {formatBytes(currentMonth.totalBytes)}
            </p>
            <p className="text-[11px] text-slate-400">Bulan berjalan</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="daily" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            30 Hari Terakhir
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1.5">
            <ArrowUp className="h-4 w-4" />
            Per Bulan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Grafik Pemakaian 30 Hari Terakhir
              </CardTitle>
              <CardDescription>
                Grafik harian download vs upload. Data per hari selama sebulan
                terakhir.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {daily.length > 0 ? (
                <CustomerUsageChart data={daily} />
              ) : (
                <p className="py-8 text-center text-sm text-slate-400">
                  Belum ada data pemakaian.
                </p>
              )}
            </CardContent>
          </Card>

          {daily.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Rincian Harian (30 Hari Terakhir)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b text-[11px] uppercase tracking-wider text-slate-400">
                        <th className="pb-2 pr-4 font-medium">Tanggal</th>
                        <th className="pb-2 pr-4 font-medium">Download</th>
                        <th className="pb-2 pr-4 font-medium">Upload</th>
                        <th className="pb-2 pr-4 font-medium">Total</th>
                        <th className="pb-2 font-medium">Sesi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...daily].reverse().map((d) => (
                        <tr
                          key={d.date}
                          className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                        >
                          <td className="py-2 pr-4 text-xs font-medium text-slate-900 dark:text-slate-100">
                            {d.date}
                          </td>
                          <td className="py-2 pr-4 text-xs text-blue-600 dark:text-blue-400">
                            {formatBytes(d.downloadBytes)}
                          </td>
                          <td className="py-2 pr-4 text-xs text-indigo-600 dark:text-indigo-400">
                            {formatBytes(d.uploadBytes)}
                          </td>
                          <td className="py-2 pr-4 text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {formatBytes(d.totalBytes)}
                          </td>
                          <td className="py-2 text-xs text-slate-600 dark:text-slate-300">
                            {d.sessionsCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-6">
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
                <p className="text-[11px] text-slate-400">
                  Sesi: {totalSessions}
                </p>
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
                    Total download vs upload per bulan pada tahun {selectedYear}
                    .
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
              {monthlyLoading ? (
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

          {!monthlyLoading && monthly.length > 0 && (
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function PortalUsagePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <PortalUsageContent />
    </Suspense>
  );
}
