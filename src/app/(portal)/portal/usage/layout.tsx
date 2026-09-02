"use client";

import { ArrowUp, CalendarDays, RefreshCw } from "lucide-react";
import type React from "react";
import { RouteTabs } from "@/components/common/route-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortal } from "@/lib/portal-context";
import { formatBytes } from "@/lib/utils";

export default function PortalUsageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, loading, refreshing, reload } = usePortal();

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        Data pemakaian tidak tersedia.
      </div>
    );
  }

  const daily = data.usageHistory ?? [];
  const monthly = data.monthlyUsage ?? [];

  // Akumulasi bulan ini: baris bulan berjalan dari data bulanan; jika belum
  // ada, fallback ke akumulasi 30 hari.
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const currentMonthEntry = monthly.find((m) => m.month === currentMonthKey);
  const currentMonthLabel =
    currentMonthEntry?.label ??
    new Date().toLocaleDateString("id-ID", { month: "long" });
  const totalDownload30d = daily.reduce((acc, d) => acc + d.downloadBytes, 0);
  const totalUpload30d = daily.reduce((acc, d) => acc + d.uploadBytes, 0);
  const totalTraffic30d = totalDownload30d + totalUpload30d;

  const currentMonth = currentMonthEntry ?? {
    downloadBytes: totalDownload30d,
    uploadBytes: totalUpload30d,
    totalBytes: totalTraffic30d,
  };

  const navTabs = [
    {
      label: "30 Hari Terakhir",
      href: "/portal/usage/daily",
      icon: CalendarDays,
    },
    {
      label: "Per Bulan",
      href: "/portal/usage/monthly",
      icon: ArrowUp,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Pemakaian Kuota & Bandwidth
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

      <RouteTabs items={navTabs} />

      <div>{children}</div>
    </div>
  );
}
