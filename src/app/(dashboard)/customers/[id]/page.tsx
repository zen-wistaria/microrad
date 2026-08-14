"use client";

import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  Edit,
  History,
  Network,
  PowerOff,
  Receipt,
  Upload,
  User,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useState } from "react";
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
import { getInvoices } from "@/lib/api/billing";
import {
  disconnectCustomer,
  getCustomerById,
  updateCustomer,
} from "@/lib/api/customers";
import {
  getCustomerMonthlyUsage,
  getCustomerUsageHistory,
} from "@/lib/api/dashboard";
import { getProfileById } from "@/lib/api/profiles";
import { getRouterById } from "@/lib/api/routers";
import {
  getCustomerActiveSession,
  getCustomerSessions,
} from "@/lib/api/sessions";
import type {
  BandwidthProfile,
  Customer,
  CustomerDailyUsage,
  CustomerMonthlyUsage,
  CustomerStatus,
  Invoice,
  NasRouter,
  Session,
} from "@/lib/types";
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
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [profile, setProfile] = useState<BandwidthProfile | null>(null);
  const [routerNas, setRouterNas] = useState<NasRouter | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessionHistory, setSessionHistory] = useState<Session[]>([]);
  const [usageHistory, setUsageHistory] = useState<CustomerDailyUsage[]>([]);
  const [monthlyUsage, setMonthlyUsage] = useState<CustomerMonthlyUsage[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    new Date().getFullYear(),
  );
  // Deret tahun (mis. 2022–2026) untuk opsi filter "Per Tahun"
  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    const arr: number[] = [];
    for (let y = cur; y >= cur - 3; y--) arr.push(y);
    return arr;
  }, []);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Disconnect Dialog
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);

  const fetchCustomerData = useCallback(async () => {
    try {
      setLoading(true);
      const cust = await getCustomerById(customerId);
      if (!cust) {
        toast.error("Pelanggan tidak ditemukan.");
        router.push("/customers");
        return;
      }
      setCustomer(cust);

      // Load data pendukung secara independen — kegagalan satu bagian tidak
      // menghapus data pelanggan yang sudah tampil.
      const [prof, rNas, activeSess, allSessions, usages, allInvoices] =
        await Promise.all([
          cust.profileId
            ? getProfileById(cust.profileId)
            : Promise.resolve(null),
          cust.nasId ? getRouterById(cust.nasId) : Promise.resolve(null),
          getCustomerActiveSession(cust.id).catch(() => null),
          getCustomerSessions(cust.id).catch(() => []),
          getCustomerUsageHistory(cust.id).catch(() => []),
          getInvoices().catch(() => []),
        ]);

      setProfile(prof);
      setRouterNas(rNas);
      setActiveSession(activeSess);
      setSessionHistory(allSessions);
      setUsageHistory(usages);
      setInvoices(
        (allInvoices || []).filter(
          (inv) =>
            inv.customerId === cust.id ||
            inv.customerUsername === cust.username,
        ),
      );
    } catch (err: unknown) {
      console.error(err);
      toast.error("Gagal memuat detail pelanggan.");
    } finally {
      setLoading(false);
    }
  }, [customerId, router]);

  useEffect(() => {
    fetchCustomerData();
  }, [fetchCustomerData]);

  // Muat pemakaian bulanan per tahun terpilih — fetch ulang saat pindah tahun
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    setMonthlyLoading(true);
    getCustomerMonthlyUsage(customerId, selectedYear)
      .then((res) => {
        if (!cancelled) setMonthlyUsage(res);
      })
      .catch((err: unknown) => {
        console.error("Gagal memuat pemakaian bulanan:", err);
        if (!cancelled) setMonthlyUsage([]);
      })
      .finally(() => {
        if (!cancelled) setMonthlyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, selectedYear]);

  const handleDisconnect = async () => {
    if (!customer) return;
    try {
      await disconnectCustomer(customer.id);
      toast.success(`Koneksi aktif ${customer.username} berhasil diputuskan.`);
      setActiveSession(null);
      setCustomer((prev) =>
        prev ? { ...prev, currentSessionId: undefined } : null,
      );
      setDisconnectModalOpen(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal memutuskan koneksi.");
    }
  };

  const handleToggleStatus = async () => {
    if (!customer) return;
    const newStatus: CustomerStatus =
      customer.status === "active" ? "suspended" : "active";
    try {
      await updateCustomer(customer.id, { status: newStatus });
      setCustomer((prev) => (prev ? { ...prev, status: newStatus } : null));
      toast.success(
        `Status ${customer.username} berhasil diubah menjadi ${newStatus === "active" ? "Aktif" : "Suspended"}.`,
      );
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal mengubah status.");
    }
  };

  if (loading) {
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
        description="Data pelanggan PPPoE yang Anda cari tidak tersedia."
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

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isOnline && (
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

          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            className="gap-1.5 text-xs text-slate-700 dark:text-slate-300"
          >
            {customer.status === "active" ? (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                Suspend (Isolir)
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Aktifkan Kembali
              </>
            )}
          </Button>

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
                  <LiveDurationCounter startedAt={activeSession.startedAt} />
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
      <Tabs defaultValue="overview" className="w-full">
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
                  <Zap className="h-4 w-4" />
                  <CardTitle className="text-base">
                    Paket Bandwidth & Kredensial
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Profil Paket:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {profile ? `${profile.name}` : "-"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">
                    Rate Limit Download / Upload:
                  </span>
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {profile
                      ? `${profile.rateLimitDown} Mbps / ${profile.rateLimitUp} Mbps`
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">Tarif Paket Bulanan:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {profile?.price ? formatRupiah(profile.price) : "-"}
                  </span>
                </div>
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
                  <span className="text-slate-500">Router NAS Ditugaskan:</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {routerNas
                      ? `${routerNas.name} (${routerNas.ipAddress})`
                      : "Semua NAS"}
                  </span>
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

            {/* Customer Metadata Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <User className="h-4 w-4" />
                  <CardTitle className="text-base">
                    Informasi Kontak & Lokasi
                  </CardTitle>
                </div>
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
              <CardTitle className="text-base">
                Catatan Histori Sesi RADIUS Accounting
              </CardTitle>
              <CardDescription>
                Daftar rekaman sesi koneksi PPPoE pelanggan yang tercatat di
                tabel <code className="text-xs">radacct</code>.
              </CardDescription>
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
                        Selesai / Durasi
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
                      sessionHistory.map((sess) => (
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
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                                Sedang Aktif
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Usage Statistics & 30-day Chart */}
        <TabsContent value="stats" className="space-y-6 pt-2">
          {/* Summary KPIs */}
          <div className="grid gap-4 sm:grid-cols-3">
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
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  Akumulasi Download
                </span>
                <p className="mt-1 text-xl font-bold text-blue-900 dark:text-blue-100">
                  {formatBytes(totalDownload30d)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <span className="text-xs text-indigo-600 dark:text-indigo-400">
                  Akumulasi Upload
                </span>
                <p className="mt-1 text-xl font-bold text-indigo-900 dark:text-indigo-100">
                  {formatBytes(totalUpload30d)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Grafik Konsumsi Bandwidth Harian (30 Hari Terakhir)
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
            <CardContent>
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
