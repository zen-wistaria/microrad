"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Edit,
  History,
  Network,
  PowerOff,
  Receipt,
  RefreshCw,
  Shield,
  Upload,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { use, useMemo, useState } from "react";
import { toast } from "sonner";
import { CustomerMonthlyUsageChart } from "@/components/charts/customer-monthly-usage-chart";
import { CustomerUsageChart } from "@/components/charts/customer-usage-chart";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LiveDurationCounter } from "@/components/common/live-counter";
import {
  CustomerStatusBadge,
  InvoiceStatusBadge,
  PaymentMethodBadge,
} from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCustomerActiveSessionQuery,
  useCustomerMonthlyUsageQuery,
  useCustomerQuery,
  useCustomerSessionsQuery,
  useCustomerUsageHistoryQuery,
  useDisconnectCustomerMutation,
  useInvoicesQuery,
  usePppProfileQuery,
  useRouterNasQuery,
  useUpdateCustomerMutation,
} from "@/lib/api/hooks";
import { queryKeys } from "@/lib/api/query-keys";
import { hasPermission } from "@/lib/rbac";
import type { CustomerStatus } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import {
  formatBytes,
  formatDate,
  formatDuration,
  formatRelativeTime,
  formatRupiah,
  getErrorMessage,
} from "@/lib/utils";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;
  const _router = useRouter();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Filter tahun grafik per bulan (via nuqs — konsisten saat refresh)
  const [selectedYear, setSelectedYear] = useQueryState(
    "year",
    parseAsInteger.withDefault(new Date().getFullYear()),
  );
  // Filter bulan (via nuqs) — "all" = 30 hari terakhir / seluruh tahun
  const [selectedMonth, setSelectedMonth] = useQueryState(
    "month",
    parseAsString.withDefault("all"),
  );

  const sessFilter = useMemo(
    () => ({
      year: selectedYear,
      month: selectedMonth !== "all" ? Number(selectedMonth) : undefined,
    }),
    [selectedYear, selectedMonth],
  );

  const usageFilter = useMemo(
    () =>
      selectedMonth !== "all"
        ? { year: selectedYear, month: Number(selectedMonth) }
        : undefined,
    [selectedYear, selectedMonth],
  );

  // Deret tahun (mis. 2022–2026) untuk opsi filter "Per Tahun"
  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    const arr: number[] = [];
    for (let y = cur; y >= cur - 3; y--) arr.push(y);
    return arr;
  }, []);

  // Tab aktif + pagination (via nuqs — konsisten saat refresh)
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("overview"),
  );
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(10).withOptions({ history: "replace" }),
  );
  const safeLimit = Math.min(Math.max(limit, 1), 50); // maksimal 50

  // Disconnect Dialog
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);

  // TanStack Query Hooks
  const {
    data: customer,
    isLoading: customerLoading,
    refetch: refetchCustomer,
    isFetching: customerFetching,
  } = useCustomerQuery(customerId);

  const { data: pppProfRes } = usePppProfileQuery(customer?.profileId || "");
  const profile = pppProfRes?.data || customer?.profile;
  const { data: routerNas } = useRouterNasQuery(customer?.nasId || "");
  const { data: activeSession } = useCustomerActiveSessionQuery(customerId);
  const { data: sessionHistory = [] } = useCustomerSessionsQuery(
    customerId,
    sessFilter,
  );
  const { data: usageHistory = [] } = useCustomerUsageHistoryQuery(
    customerId,
    usageFilter,
  );
  const { data: monthlyUsage = [], isLoading: monthlyLoading } =
    useCustomerMonthlyUsageQuery(customerId, selectedYear);
  const { data: invoicesRes } = useInvoicesQuery({ limit: 1000 });

  const invoices = useMemo(() => {
    if (!customer || !invoicesRes?.data) return [];
    return invoicesRes.data.filter(
      (inv) =>
        inv.customerId === customer.id ||
        inv.customerUsername === customer.username,
    );
  }, [customer, invoicesRes]);

  const disconnectCustomerMutation = useDisconnectCustomerMutation();
  const updateCustomerMutation = useUpdateCustomerMutation();

  const handleDisconnect = async () => {
    if (!customer) return;
    try {
      await disconnectCustomerMutation.mutateAsync(customer.id);
      toast.success(`Koneksi aktif ${customer.username} berhasil diputuskan.`);
      setDisconnectModalOpen(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal memutuskan koneksi.");
    }
  };

  const handleUpdateStatus = async (newStatus: CustomerStatus) => {
    if (!customer) return;
    try {
      await updateCustomerMutation.mutateAsync({
        id: customer.id,
        updates: { status: newStatus },
      });
      if (newStatus !== "active") {
        try {
          await disconnectCustomerMutation.mutateAsync(customer.id);
        } catch {
          // best effort
        }
      }
      const labelMap: Record<CustomerStatus, string> = {
        active: "Aktif",
        suspended: "Suspend (Isolir)",
        disabled: "Dinonaktifkan (Disabled)",
      };
      toast.success(
        `Status ${customer.username} berhasil diubah menjadi ${labelMap[newStatus]}${
          newStatus !== "active" ? " & koneksi aktif diputuskan" : ""
        }.`,
      );
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal mengubah status.");
    }
  };

  const handleManualRefresh = () => {
    refetchCustomer();
    queryClient.invalidateQueries({
      queryKey: queryKeys.customers.detail(customerId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.customers.activeSession(customerId),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.customers.sessions(customerId, sessFilter),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.customers.usageHistory(customerId, usageFilter),
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.customers.monthlyUsage(customerId, selectedYear),
    });
    toast.success("Data pelanggan berhasil disegarkan.");
  };

  // Pagination slice — tab sesi
  const sessionTotalPages = Math.ceil(sessionHistory.length / safeLimit) || 1;
  const sessionSafePage = Math.min(Math.max(page, 1), sessionTotalPages);
  const paginatedSessions = useMemo(() => {
    const start = (sessionSafePage - 1) * safeLimit;
    return sessionHistory.slice(start, start + safeLimit);
  }, [sessionHistory, sessionSafePage, safeLimit]);

  // Pagination slice — tab tagihan
  const invoiceTotalPages = Math.ceil(invoices.length / safeLimit) || 1;
  const invoiceSafePage = Math.min(Math.max(page, 1), invoiceTotalPages);
  const paginatedInvoices = useMemo(() => {
    const start = (invoiceSafePage - 1) * safeLimit;
    return invoices.slice(start, start + safeLimit);
  }, [invoices, invoiceSafePage, safeLimit]);

  if (customerLoading && !customer) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <EmptyState
        title="Pelanggan Tidak Ditemukan"
        description="Data pelanggan yang Anda cari tidak tersedia."
        actionLabel="Kembali ke Daftar Pelanggan"
        actionHref="/customers"
      />
    );
  }

  const isOnline = Boolean(activeSession && !activeSession.stoppedAt);

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

  // Akumulasi bulan ini: pakai baris bulan berjalan dari data bulanan (sesuai
  // tahun terpilih); jika belum ada (loading/error), fallback ke akumulasi 30 hari.
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const currentMonthEntry = monthlyUsage.find(
    (m) => m.month === currentMonthKey,
  );
  // Nama bulan berjalan dalam kurung (mis. "(Agustus)") — pakai label data
  // bulanan bila ada, fallback ke nama bulan lokal saat ini.
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
    <div className="space-y-6">
      {/* Top Navigation & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild className="h-9 w-9">
            <Link href="/customers">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 font-mono">
                {customer.username}
              </h1>
              <CustomerStatusBadge
                status={customer.status}
                isOnline={isOnline}
              />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {customer.fullName ? `${customer.fullName} • ` : ""}Terdaftar
              sejak {formatDate(customer.createdAt)}
            </p>
          </div>
        </div>

        {/* Action Buttons (dibatasi permission RBAC) */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={customerFetching}
            className="gap-1.5 text-xs text-slate-600 dark:text-slate-400"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${customerFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          {isOnline && hasPermission(currentUser, "session.update") && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDisconnectModalOpen(true)}
              className="gap-1.5 text-xs shadow-xs"
            >
              <PowerOff className="h-3.5 w-3.5" />
              Putuskan Koneksi
            </Button>
          )}

          {hasPermission(currentUser, "customer.update") && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-slate-700 dark:text-slate-300"
                >
                  {customer.status === "active" && (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      Status: Aktif
                    </>
                  )}
                  {customer.status === "suspended" && (
                    <>
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                      Status: Suspend
                    </>
                  )}
                  {customer.status === "disabled" && (
                    <>
                      <Ban className="h-3.5 w-3.5 text-rose-500" />
                      Status: Disabled
                    </>
                  )}
                  <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs">
                  Ubah Status Layanan
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {customer.status !== "active" && (
                  <DropdownMenuItem
                    onClick={() => handleUpdateStatus("active")}
                    className="cursor-pointer text-xs text-emerald-600 focus:text-emerald-600 dark:text-emerald-400"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" />
                    Aktifkan Kembali
                  </DropdownMenuItem>
                )}
                {customer.status !== "suspended" && (
                  <DropdownMenuItem
                    onClick={() => handleUpdateStatus("suspended")}
                    className="cursor-pointer text-xs text-amber-600 focus:text-amber-600 dark:text-amber-400"
                  >
                    <AlertCircle className="mr-2 h-4 w-4 text-amber-500" />
                    Suspend (Isolir)
                  </DropdownMenuItem>
                )}
                {customer.status !== "disabled" && (
                  <DropdownMenuItem
                    onClick={() => handleUpdateStatus("disabled")}
                    className="cursor-pointer text-xs text-rose-600 focus:text-rose-600 dark:text-rose-400"
                  >
                    <Ban className="mr-2 h-4 w-4 text-rose-500" />
                    Nonaktifkan (Disable)
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {hasPermission(currentUser, "customer.update") && (
            <Button
              asChild
              size="sm"
              variant="default"
              className="gap-1.5 text-xs"
            >
              <Link href={`/customers/${customer.id}/edit`}>
                <Edit className="h-3.5 w-3.5" />
                Edit Akun
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Section 1: Active Live Session Banner (If Online) */}
      {isOnline && activeSession && (
        <Card className="border-emerald-500/30 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-800/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <CardTitle className="text-base font-bold">
                  Sesi PPPoE Saat Ini Sedang Berjalan
                </CardTitle>
              </div>
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Live Status
              </span>
            </div>
            <CardDescription className="text-emerald-600/80 dark:text-emerald-400/80">
              Pelanggan sedang terhubung ke router MikroTik (
              {routerNas?.name || activeSession.nasIpAddress})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-white/80 p-3 shadow-xs dark:bg-slate-900/80">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  Durasi Online
                </div>
                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  <LiveDurationCounter
                    startedAt={activeSession.startedAt}
                    baseSeconds={
                      activeSession.durationSeconds > 0
                        ? activeSession.durationSeconds
                        : undefined
                    }
                  />
                </div>
              </div>

              <div className="rounded-lg bg-white/80 p-3 shadow-xs dark:bg-slate-900/80">
                <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                  <Download className="h-3.5 w-3.5" />
                  Download Sesi Ini
                </div>
                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatBytes(activeSession.outputBytes)}
                </div>
              </div>

              <div className="rounded-lg bg-white/80 p-3 shadow-xs dark:bg-slate-900/80">
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                  <Upload className="h-3.5 w-3.5" />
                  Upload Sesi Ini
                </div>
                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatBytes(activeSession.inputBytes)}
                </div>
              </div>

              <div className="rounded-lg bg-white/80 p-3 shadow-xs dark:bg-slate-900/80">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Network className="h-3.5 w-3.5" />
                  Framed IP Terpasang
                </div>
                <div className="mt-1 font-mono text-base font-bold text-slate-900 dark:text-slate-100">
                  {activeSession.framedIp ||
                    customer.staticIp ||
                    "Dynamic Pool"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs Section: Overview, History, Usage Stats, Billing */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="overview" className="gap-1.5 text-xs">
            <User className="h-3.5 w-3.5" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 text-xs">
            <History className="h-3.5 w-3.5" />
            Sesi ({sessionHistory.length})
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" />
            Statistik
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5 text-xs">
            <Receipt className="h-3.5 w-3.5" />
            Tagihan ({invoices.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview Info */}
        <TabsContent value="overview" className="space-y-6 pt-2">
          <div className="grid gap-6 md:grid-cols-2">
            {/* PPPoE & Bandwidth Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Shield className="h-4 w-4" />
                  <CardTitle className="text-base">
                    Kredensial PPPoE & Paket Bandwidth
                  </CardTitle>
                </div>
                <CardDescription>
                  Kredensial koneksi internet untuk router/ONT pelanggan
                  (FreeRADIUS).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Username PPPoE:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                    {customer.username}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Password PPPoE:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {customer.password ? customer.password : "••••••••"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Paket Layanan:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {profile ? `${profile.name}` : "-"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Kecepatan (Bandwidth):</span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {profile?.bandwidth
                      ? `↓${profile.bandwidth.maxDownload} ${profile.bandwidth.maxDownloadUnit} / ↑${profile.bandwidth.maxUpload} ${profile.bandwidth.maxUploadUnit}`
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Tarif Paket Bulanan:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {profile?.price ? formatRupiah(profile.price) : "-"}
                  </span>
                </div>
                {profile?.profileGroup && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500">
                      Profile Group (Gateway):
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {profile.profileGroup.name} (
                      {profile.profileGroup.localAddress})
                    </span>
                  </div>
                )}
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">IP Statis (Framed-IP):</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                    {customer.staticIp || (
                      <span className="text-slate-400 italic">
                        Dynamic Pool
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">
                    Mode Sesi (Simultaneous-Use):
                  </span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {customer.sessionMode === "multi" ? (
                      <Badge
                        variant="secondary"
                        className="text-violet-600 bg-violet-50 dark:bg-violet-950/40 dark:text-violet-300"
                      >
                        Multi Session (Maks {customer.maxSimultaneous || 2}{" "}
                        Sesi)
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-slate-700 dark:text-slate-300"
                      >
                        Single Session (1 Sesi)
                      </Badge>
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Router NAS Diizinkan:</span>
                  <div className="text-right">
                    {customer.bindOnNas ? (
                      customer.allowedNasIps &&
                      customer.allowedNasIps.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-end max-w-[240px]">
                          {customer.allowedNasIps.map((ip) => (
                            <Badge
                              key={ip}
                              variant="outline"
                              className="font-mono text-[10px] text-indigo-600 border-indigo-200 dark:border-indigo-800"
                            >
                              {ip}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-indigo-600 border-indigo-200"
                        >
                          {routerNas ? routerNas.name : "Terkunci"}
                        </Badge>
                      )
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-slate-600 dark:text-slate-400"
                      >
                        Semua Router NAS
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Terakhir Online:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {isOnline
                      ? "Sedang Online"
                      : formatRelativeTime(customer.lastSeenAt)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Customer Metadata & Portal Account Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <User className="h-4 w-4" />
                  <CardTitle className="text-base">
                    Informasi Kontak & Akun Portal
                  </CardTitle>
                </div>
                <CardDescription>
                  Identitas pelanggan dan akses akun login web Portal Pelanggan.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Nama Lengkap:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {customer.fullName || "-"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">No. Telepon / WA:</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                    {customer.phone || "-"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Email Akun Portal:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {customer.email ||
                      (customer.portalUser?.email ? (
                        customer.portalUser.email
                      ) : (
                        <span className="text-slate-400 italic">
                          Belum terdaftar
                        </span>
                      ))}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Status Akun Portal:</span>
                  <span className="font-medium">
                    {customer.status === "disabled" ? (
                      <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-semibold">
                        <Ban className="h-3.5 w-3.5 text-rose-500" />
                        Nonaktif (Akses Ditutup)
                      </span>
                    ) : customer.status === "suspended" ? (
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                        Suspended (Terisolir)
                      </span>
                    ) : customer.portalUser || customer.email ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Aktif
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">
                        Belum Terdaftar
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Alamat Pemasangan:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100 text-right max-w-[200px] sm:max-w-xs">
                    {customer.address || "-"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Tanggal Registrasi:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {formatDate(customer.createdAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Session History */}
        <TabsContent value="history" className="pt-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    Catatan Histori Sesi RADIUS Accounting
                  </CardTitle>
                  <CardDescription>
                    Semua rekaman sesi PPPoE pelanggan (online & selesai) dari
                    tabel <code className="text-xs">radacct</code>.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(selectedYear)}
                    onValueChange={(v) => setSelectedYear(Number(v))}
                  >
                    <SelectTrigger className="w-28 h-9">
                      <SelectValue placeholder="Tahun" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedMonth}
                    onValueChange={(v) => setSelectedMonth(v)}
                  >
                    <SelectTrigger className="w-32 h-9">
                      <SelectValue placeholder="Bulan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua</SelectItem>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {new Date(0, m - 1, 1).toLocaleDateString("id-ID", {
                            month: "long",
                          })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50/80 text-slate-500 border-y border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">
                        Mulai Koneksi
                      </th>
                      <th className="py-2.5 px-4 font-semibold">
                        Durasi / Selesai
                      </th>
                      <th className="py-2.5 px-4 font-semibold">Download</th>
                      <th className="py-2.5 px-4 font-semibold">Upload</th>
                      <th className="py-2.5 px-4 font-semibold">
                        Router (NAS)
                      </th>
                      <th className="py-2.5 px-4 font-semibold">
                        Sebab Berhenti
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {sessionHistory.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-slate-400"
                        >
                          Belum ada riwayat sesi yang tercatat untuk pelanggan
                          ini.
                        </td>
                      </tr>
                    ) : (
                      paginatedSessions.map((sess) => (
                        <tr
                          key={sess.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {formatDate(sess.startedAt)}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">
                              IP: {sess.framedIp || "-"}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {!sess.stoppedAt ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                Online
                              </span>
                            ) : (
                              <div>
                                <div className="font-medium text-slate-700 dark:text-slate-300">
                                  {formatDuration(sess.durationSeconds)}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Putus: {formatDate(sess.stoppedAt)}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-blue-600 dark:text-blue-400">
                            {formatBytes(sess.outputBytes)}
                          </td>
                          <td className="py-3 px-4 font-medium text-indigo-600 dark:text-indigo-400">
                            {formatBytes(sess.inputBytes)}
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                            {sess.nasIpAddress}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {sess.terminateCause ||
                                (sess.stoppedAt ? "Normal" : "Active")}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer — Sesi */}
              {sessionHistory.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>
                      Menampilkan{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {Math.min(
                          (sessionSafePage - 1) * safeLimit + 1,
                          sessionHistory.length,
                        )}
                      </span>{" "}
                      -{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {Math.min(
                          sessionSafePage * safeLimit,
                          sessionHistory.length,
                        )}
                      </span>{" "}
                      dari{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {sessionHistory.length}
                      </span>{" "}
                      sesi
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
                      disabled={sessionSafePage === 1}
                      className="h-8 px-3 text-xs"
                    >
                      Sebelumnya
                    </Button>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Hal {sessionSafePage} dari {sessionTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(sessionTotalPages, p + 1))
                      }
                      disabled={sessionSafePage === sessionTotalPages}
                      className="h-8 px-3 text-xs"
                    >
                      Selanjutnya
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Usage Statistics & 30-day Chart */}
        <TabsContent value="stats" className="space-y-6 pt-2">
          {/* Summary KPIs: 30 hari terakhir + pemakaian bulan ini */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <span className="text-xs text-slate-500">
                  Total Trafik 30 Hari
                </span>
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
              {/* Akumulasi 1 tahun — mengikuti tahun terpilih pada filter */}
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
        </TabsContent>

        {/* Tab 4: Billing Invoices */}
        <TabsContent value="billing" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    Riwayat Tagihan & Faktur Pelanggan
                  </CardTitle>
                  <CardDescription>
                    Daftar faktur tagihan bulanan PPPoE untuk akun{" "}
                    {customer.username}.
                  </CardDescription>
                </div>
                <Button asChild size="xs" variant="outline">
                  <Link
                    href={`/billing?search=${encodeURIComponent(customer.username)}`}
                  >
                    Buka di Menu Billing
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50/80 text-slate-500 border-y border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">No. Invoice</th>
                      <th className="py-2.5 px-4 font-semibold">
                        Paket & Periode
                      </th>
                      <th className="py-2.5 px-4 font-semibold">
                        Total Tagihan
                      </th>
                      <th className="py-2.5 px-4 font-semibold">Jatuh Tempo</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold">Metode</th>
                      <th className="py-2.5 px-4 font-semibold text-right">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {invoices.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-slate-400"
                        >
                          Belum ada tagihan yang diterbitkan untuk pelanggan
                          ini.
                        </td>
                      </tr>
                    ) : (
                      paginatedInvoices.map((inv) => (
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

              {/* Pagination Footer — Tagihan */}
              {invoices.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>
                      Menampilkan{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {Math.min(
                          (invoiceSafePage - 1) * safeLimit + 1,
                          invoices.length,
                        )}
                      </span>{" "}
                      -{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {Math.min(invoiceSafePage * safeLimit, invoices.length)}
                      </span>{" "}
                      dari{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {invoices.length}
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
        </TabsContent>
      </Tabs>

      {/* Disconnect Modal */}
      <ConfirmDialog
        open={disconnectModalOpen}
        onOpenChange={setDisconnectModalOpen}
        title="Putuskan Sesi PPPoE Pelanggan?"
        description={`Apakah Anda yakin ingin memutus koneksi aktif untuk '${customer.username}'? Pelanggan akan terputus dari router MikroTik.`}
        confirmLabel="Putuskan Koneksi"
        variant="destructive"
        onConfirm={handleDisconnect}
      />
    </div>
  );
}
