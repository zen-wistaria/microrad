"use client";

import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Plus,
  RefreshCw,
  Router as RouterIcon,
  TrendingUp,
  Users,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { UsageTrendChart } from "@/components/charts/usage-trend-chart";
import { LiveDurationCounter } from "@/components/common/live-counter";
import { CustomerStatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCustomersQuery,
  useDashboardQuery,
  useSessionsQuery,
} from "@/lib/api/hooks";
import { formatBytes } from "@/lib/utils";

export default function DashboardPage() {
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchDashboard,
    isFetching,
  } = useDashboardQuery();

  const { data: sessionsRes } = useSessionsQuery({
    activeOnly: true,
    limit: 5,
  });

  const { data: customersRes } = useCustomersQuery({ limit: 5 });

  const activeSessions = sessionsRes?.data || [];
  const recentCustomers = customersRes?.data || [];
  const loading = statsLoading && !stats;

  const totalTraffic7DaysBytes = useMemo(() => {
    if (!stats?.usageTrend) return 0;
    return stats.usageTrend.reduce(
      (acc: number, point) => acc + (point.downloadBytes + point.uploadBytes),
      0,
    );
  }, [stats?.usageTrend]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Dashboard Monitoring
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ringkasan status infrastruktur PPPoE, router MikroTik, dan sesi
            pelanggan aktif.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchDashboard()}
            disabled={isFetching}
            className="gap-1.5 text-xs text-slate-600 dark:text-slate-400"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button asChild size="sm" className="gap-1.5 text-xs shadow-sm">
            <Link href="/customers/new">
              <Plus className="h-4 w-4" />
              Tambah Pelanggan
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Customer */}
        <Card className="relative overflow-hidden border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute top-0 left-0 h-1 w-full bg-blue-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Pelanggan
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {stats?.totalCustomers ?? 0}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {stats?.activeCustomers ?? 0} Aktif
                </span>
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Terdaftar di basis data FreeRADIUS
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Customer Online */}
        <Card className="relative overflow-hidden border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute top-0 left-0 h-1 w-full bg-emerald-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sedang Online
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Wifi className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {stats?.onlineNow ?? 0}
                  </span>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  {stats?.totalCustomers
                    ? `${Math.round((stats.onlineNow / stats.totalCustomers) * 100)}%`
                    : "0%"}
                </span>
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Sesi terhubung di seluruh router
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Customer Suspended */}
        <Card className="relative overflow-hidden border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute top-0 left-0 h-1 w-full bg-amber-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Suspended (Isolir)
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                  {stats?.suspendedCustomers ?? 0}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Pelanggan
                </span>
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Akses internet dibatasi sementara
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Router NAS Online */}
        <Card className="relative overflow-hidden border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute top-0 left-0 h-1 w-full bg-indigo-500" />
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Router NAS MikroTik
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <RouterIcon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {stats?.totalRoutersOnline ?? 0} /{" "}
                  {(stats?.totalRoutersOnline ?? 0) +
                    (stats?.totalRoutersOffline ?? 0)}
                </span>
                <span className="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Online
                </span>
              </div>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              {stats?.totalRoutersOffline
                ? `${stats.totalRoutersOffline} router offline`
                : "Semua router normal"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Traffic Trend Chart & Stats Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Chart (2 Cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-base">
                  Tren Trafik Bandwidth 7 Hari
                </CardTitle>
              </div>
              <CardDescription>
                Akumulasi pemakaian bandwidth upload dan download seluruh sesi
                PPPoE.
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Total Trafik 7 Hari</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {formatBytes(totalTraffic7DaysBytes)}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {loading || !stats ? (
              <Skeleton className="h-75 w-full" />
            ) : (
              <UsageTrendChart data={stats.usageTrend} />
            )}
          </CardContent>
        </Card>

        {/* Traffic Breakdown Summary (1 Col) */}
        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Statistik Pemakaian Hari Ini
            </CardTitle>
            <CardDescription>Distribusi download dan upload</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-blue-50/70 p-4 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  Total Download
                </span>
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                  {stats
                    ? `${Math.round((stats.totalDownloadTodayBytes / (stats.totalTrafficTodayBytes || 1)) * 100)}%`
                    : "0%"}
                </span>
              </div>
              <p className="mt-1 text-xl font-bold text-blue-950 dark:text-blue-100">
                {formatBytes(stats?.totalDownloadTodayBytes ?? 0)}
              </p>
            </div>

            <div className="rounded-lg bg-purple-50/70 p-4 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                  Total Upload
                </span>
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                  {stats
                    ? `${Math.round((stats.totalUploadTodayBytes / (stats.totalTrafficTodayBytes || 1)) * 100)}%`
                    : "0%"}
                </span>
              </div>
              <p className="mt-1 text-xl font-bold text-purple-950 dark:text-purple-100">
                {formatBytes(stats?.totalUploadTodayBytes ?? 0)}
              </p>
            </div>

            <div className="rounded-lg bg-emerald-50/70 p-4 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Total Trafik
                </span>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {stats
                    ? `${Math.round((stats.totalTrafficTodayBytes / (stats.totalTrafficTodayBytes || 1)) * 100)}%`
                    : "0%"}
                </span>
              </div>
              <p className="mt-1 text-xl font-bold text-emerald-950 dark:text-emerald-100">
                {formatBytes(stats?.totalTrafficTodayBytes ?? 0)}
              </p>
            </div>
          </CardContent>
          <div className="p-6 pt-0">
            <Button asChild variant="outline" className="w-full text-xs gap-1">
              <Link href="/sessions">
                Lihat Monitoring Sesi Lengkap
                <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>

      {/* Two Tables Grid: Active Sessions & Recent Customers */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Table 1: Sesi Aktif Terbaru */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-base">Sesi Aktif Terbaru</CardTitle>
              </div>
              <CardDescription>
                Pelanggan yang saat ini sedang online
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/sessions">
                Lihat Semua
                <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 border-y border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Pelanggan</th>
                    <th className="py-2.5 px-4 font-semibold">IP Address</th>
                    <th className="py-2.5 px-4 font-semibold">Durasi</th>
                    <th className="py-2.5 px-4 font-semibold text-right">
                      Download
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={4} className="p-4">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : activeSessions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 text-center text-slate-400"
                      >
                        Tidak ada sesi aktif saat ini.
                      </td>
                    </tr>
                  ) : (
                    activeSessions.map((session) => (
                      <tr
                        key={session.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                      >
                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                          <Link
                            href={`/customers/${session.customerId}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {session.customerUsername}
                          </Link>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                          {session.framedIp || "-"}
                        </td>
                        <td className="py-3 px-4">
                          <LiveDurationCounter startedAt={session.startedAt} />
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-slate-100">
                          {formatBytes(session.outputBytes)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Table 2: Pelanggan Terbaru */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-base">Daftar Pelanggan</CardTitle>
              </div>
              <CardDescription>Akun PPPoE yang terdaftar</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href="/customers">
                Kelola Semua
                <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 border-y border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Username</th>
                    <th className="py-2.5 px-4 font-semibold">Nama Lengkap</th>
                    <th className="py-2.5 px-4 font-semibold">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={4} className="p-4">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : recentCustomers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="py-6 text-center text-slate-400"
                      >
                        Belum ada pelanggan terdaftar.
                      </td>
                    </tr>
                  ) : (
                    recentCustomers.map((cust) => (
                      <tr
                        key={cust.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                      >
                        <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                          {cust.username}
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 truncate max-w-35">
                          {cust.fullName || "-"}
                        </td>
                        <td className="py-3 px-4">
                          <CustomerStatusBadge
                            status={cust.status}
                            isOnline={false}
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                          >
                            <Link href={`/customers/${cust.id}`}>Detail</Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
