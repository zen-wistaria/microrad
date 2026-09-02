"use client";

import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import { CustomerMonthlyUsageChart } from "@/components/charts/customer-monthly-usage-chart";
import { CustomerUsageChart } from "@/components/charts/customer-usage-chart";
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
import {
  useCustomerMonthlyUsageQuery,
  useCustomerUsageHistoryQuery,
} from "@/lib/api/hooks";
import { formatBytes } from "@/lib/utils";
import { useCustomerDetail } from "../customer-detail-context";

export default function CustomerStatsPage() {
  const { customerId } = useCustomerDetail();

  // Filter tahun grafik (via nuqs)
  const [selectedYear, setSelectedYear] = useQueryState(
    "year",
    parseAsInteger.withDefault(new Date().getFullYear()),
  );
  // Filter bulan (via nuqs)
  const [selectedMonth] = useQueryState(
    "month",
    parseAsString.withDefault("all"),
  );

  const usageFilter = useMemo(
    () =>
      selectedMonth !== "all"
        ? { year: selectedYear, month: Number(selectedMonth) }
        : undefined,
    [selectedYear, selectedMonth],
  );

  const { data: usageHistory = [] } = useCustomerUsageHistoryQuery(
    customerId,
    usageFilter,
  );
  const { data: monthlyUsage = [], isLoading: monthlyLoading } =
    useCustomerMonthlyUsageQuery(customerId, selectedYear);

  // Deret tahun (mis. 2022–2026) untuk opsi filter
  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    const arr: number[] = [];
    for (let y = cur; y >= cur - 3; y--) arr.push(y);
    return arr;
  }, []);

  // Total 30-day usage aggregation
  const totalDownload30d = usageHistory.reduce(
    (acc, u) => acc + u.downloadBytes,
    0,
  );
  const totalUpload30d = usageHistory.reduce(
    (acc, u) => acc + u.uploadBytes,
    0,
  );
  const totalTraffic30d = totalDownload30d + totalUpload30d;

  // Akumulasi bulan ini
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const currentMonthEntry = monthlyUsage.find(
    (m) => m.month === currentMonthKey,
  );
  const currentMonthLabel =
    currentMonthEntry?.label ??
    new Date().toLocaleDateString("id-ID", { month: "long" });
  const currentMonth = currentMonthEntry ?? {
    downloadBytes: totalDownload30d,
    uploadBytes: totalUpload30d,
    totalBytes: totalTraffic30d,
  };

  const totalYearlyDown = monthlyUsage.reduce(
    (acc, m) => acc + m.downloadBytes,
    0,
  );
  const totalYearlyUp = monthlyUsage.reduce((acc, m) => acc + m.uploadBytes, 0);
  const totalYearly = monthlyUsage.reduce((acc, m) => acc + m.totalBytes, 0);

  return (
    <div className="space-y-6 pt-2">
      {/* Summary KPIs: 30 hari terakhir + pemakaian bulan ini */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500">Total Trafik 30 Hari</span>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              {formatBytes(totalTraffic30d)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500">
              Pemakaian Bulan Ini (Download)
            </span>
            <p className="mt-1 text-xl font-bold text-blue-900 dark:text-blue-100">
              {formatBytes(currentMonth.downloadBytes)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500">
              Pemakaian Bulan Ini (Upload)
            </span>
            <p className="mt-1 text-xl font-bold text-indigo-900 dark:text-indigo-100">
              {formatBytes(currentMonth.uploadBytes)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500">
              Total Pemakaian Bulan Ini ({currentMonthLabel})
            </span>
            <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
              {formatBytes(currentMonth.totalBytes)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Grafik Konsumsi Bandwidth Harian
            {selectedMonth !== "all"
              ? ` (${new Date(0, Number(selectedMonth) - 1, 1).toLocaleDateString("id-ID", { month: "long" })} ${selectedYear})`
              : " (30 Hari Terakhir)"}
          </CardTitle>
          <CardDescription>
            Statistik pemakaian data download & upload harian pelanggan ini.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerUsageChart data={usageHistory} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">
                Grafik Konsumsi Bandwidth Per Bulan
              </CardTitle>
              <CardDescription>
                Pemakaian download & upload bulanan pelanggan ini.
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
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Akumulasi 1 tahun */}
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
              </CardContent>
            </Card>
          </div>
          {monthlyLoading ? (
            <div className="flex h-70 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <CustomerMonthlyUsageChart data={monthlyUsage} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
