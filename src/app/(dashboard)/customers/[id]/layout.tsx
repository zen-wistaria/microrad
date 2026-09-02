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
  Upload,
  User,
} from "lucide-react";
import Link from "next/link";
import type React from "react";
import { use, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LiveDurationCounter } from "@/components/common/live-counter";
import { RouteTabs } from "@/components/common/route-tabs";
import { CustomerStatusBadge } from "@/components/common/status-badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCustomerActiveSessionQuery,
  useCustomerQuery,
  useCustomerSessionsQuery,
  useDisconnectCustomerMutation,
  useInternetProfileQuery,
  useInvoicesQuery,
  useProfileGroupQuery,
  useRouterNasQuery,
  useUpdateCustomerMutation,
} from "@/lib/api/hooks";
import { queryKeys } from "@/lib/api/query-keys";
import { hasPermission } from "@/lib/rbac";
import type { CustomerStatus } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { formatBytes, formatDate, getErrorMessage } from "@/lib/utils";
import { CustomerDetailContext } from "./customer-detail-context";

interface CustomerDetailLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default function CustomerDetailLayout({
  children,
  params,
}: CustomerDetailLayoutProps) {
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);

  // TanStack Query Hooks
  const {
    data: customer,
    isLoading: customerLoading,
    refetch: refetchCustomer,
    isFetching: customerFetching,
  } = useCustomerQuery(customerId);

  const { data: netProfRes } = useInternetProfileQuery(
    customer?.profileId || "",
  );
  const profile = netProfRes?.data || customer?.profile;
  const { data: grpRes } = useProfileGroupQuery(customer?.profileGroupId || "");
  const profileGroup = grpRes?.data || customer?.profileGroup;
  const { data: routerNas } = useRouterNasQuery(customer?.nasId || "");
  const { data: activeSession } = useCustomerActiveSessionQuery(customerId);

  // Quick count queries for tab labels
  const { data: sessionRes } = useCustomerSessionsQuery(customerId, {
    page: 1,
    limit: 1,
  });
  const sessionTotalCount = sessionRes?.total ?? 0;

  const { data: invoicesRes } = useInvoicesQuery({
    customerId,
    page: 1,
    limit: 1,
  });
  const invoiceTotalCount = invoicesRes?.total ?? 0;

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
      queryKey: ["customer-sessions", customerId],
    });
    queryClient.invalidateQueries({
      queryKey: ["customer-usage-history", customerId],
    });
    queryClient.invalidateQueries({
      queryKey: ["customer-monthly-usage", customerId],
    });
    queryClient.invalidateQueries({
      queryKey: ["invoices"],
    });
    toast.success("Data pelanggan berhasil disegarkan.");
  };

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

  const navTabs = [
    {
      label: "Profil",
      href: `/customers/${customerId}/overview`,
      icon: User,
    },
    {
      label: `Sesi (${sessionTotalCount})`,
      href: `/customers/${customerId}/history`,
      icon: History,
    },
    {
      label: "Statistik",
      href: `/customers/${customerId}/stats`,
      icon: BarChart3,
    },
    {
      label: `Tagihan (${invoiceTotalCount})`,
      href: `/customers/${customerId}/billing`,
      icon: Receipt,
    },
  ];

  return (
    <CustomerDetailContext.Provider
      value={{
        customerId,
        customer,
        isLoading: customerLoading,
        isFetching: customerFetching,
        refetchCustomer,
        profile,
        profileGroup,
        routerNas,
        activeSession,
        sessionTotalCount,
        invoiceTotalCount,
      }}
    >
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

        {/* Route Tabs Section */}
        <RouteTabs
          items={navTabs}
          listClassName="grid w-full grid-cols-4 max-w-lg"
        />

        {/* Subroute Content */}
        <div>{children}</div>

        {/* Disconnect Modal */}
        <ConfirmDialog
          open={disconnectModalOpen}
          onOpenChange={setDisconnectModalOpen}
          title="Putuskan Sesi PPPoE Pelanggan?"
          description={`Koneksi aktif untuk ${customer.username} (IP: ${activeSession?.framedIp || customer.staticIp || "Dynamic"}) pada router ${routerNas?.name || activeSession?.nasIpAddress} akan diputus seketika via RADIUS CoA.`}
          confirmLabel="Putuskan Sekarang"
          variant="destructive"
          onConfirm={handleDisconnect}
        />
      </div>
    </CustomerDetailContext.Provider>
  );
}
