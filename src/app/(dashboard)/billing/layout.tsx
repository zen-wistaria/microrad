"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Plus,
  Receipt,
  RefreshCw,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { BulkGenerateDialog } from "@/components/billing/bulk-generate-dialog";
import { CreateInvoiceDialog } from "@/components/billing/create-invoice-dialog";
import { RouteTabs } from "@/components/common/route-tabs";
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
  useBillingSummaryQuery,
  useCustomersQuery,
  useInternetProfilesQuery,
  useInvoicesQuery,
  usePaymentsQuery,
} from "@/lib/api/hooks";
import { hasPermission } from "@/lib/rbac";
import { useAuth } from "@/lib/use-auth";
import { formatRupiah } from "@/lib/utils";

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const canCreateBilling = hasPermission(currentUser, "billing.create");

  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const {
    data: summary,
    isLoading: summaryLoading,
    isFetching: summaryFetching,
    refetch: refetchSummary,
  } = useBillingSummaryQuery();

  const { data: invRes } = useInvoicesQuery({ page: 1, limit: 1 });
  const { data: payRes } = usePaymentsQuery({ page: 1, limit: 1 });

  const { data: custRes } = useCustomersQuery({ limit: 1000 });
  const customers = custRes?.data || [];
  const { data: profRes } = useInternetProfilesQuery();
  const profiles = profRes?.data || [];

  const totalInvoicesCount = invRes?.total ?? summary?.totalInvoicesCount ?? 0;
  const totalPaymentsCount = payRes?.total ?? 0;

  const refetchAll = () => {
    refetchSummary();
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["billing-summary"] });
  };

  const navTabs = [
    {
      label: (
        <span className="flex items-center gap-2">
          <span>Daftar Tagihan</span>
          <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 text-[10px] font-bold">
            {totalInvoicesCount}
          </span>
        </span>
      ),
      href: "/billing/invoices",
      icon: Receipt,
    },
    {
      label: (
        <span className="flex items-center gap-2">
          <span>Riwayat Pembayaran</span>
          <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 text-[10px] font-bold">
            {totalPaymentsCount}
          </span>
        </span>
      ),
      href: "/billing/payments",
      icon: CreditCard,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Billing & Tagihan Pelanggan
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kelola faktur, tagihan internet bulanan, status pembayaran, dan
            pengingat WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={refetchAll}
            disabled={summaryFetching}
            className="gap-1.5 text-xs text-slate-600 dark:text-slate-400"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${summaryFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          {canCreateBilling && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setBulkOpen(true)}
              className="gap-1.5 text-xs shadow-xs"
            >
              <CalendarCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              Generate Tagihan Massal
            </Button>
          )}

          {canCreateBilling && (
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="gap-1.5 text-xs shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Buat Tagihan Baru
            </Button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Revenue this month */}
        <Card className="relative overflow-hidden border-slate-200 dark:border-slate-800">
          <div className="absolute right-3 top-3 rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">
              Penerimaan Bulan Ini
            </CardDescription>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              {summaryLoading ? (
                <Skeleton className="h-7 w-32" />
              ) : (
                formatRupiah(summary?.totalRevenueThisMonth || 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{summary?.paidCount || 0} Invoice Lunas</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Pending / Unpaid */}
        <Card className="relative overflow-hidden border-slate-200 dark:border-slate-800">
          <div className="absolute right-3 top-3 rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Clock className="h-5 w-5" />
          </div>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">
              Tertunggak (Belum Bayar)
            </CardDescription>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              {summaryLoading ? (
                <Skeleton className="h-7 w-32" />
              ) : (
                formatRupiah(summary?.totalPendingAmount || 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{summary?.unpaidCount || 0} Invoice Menunggu</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Overdue */}
        <Card className="relative overflow-hidden border-slate-200 dark:border-slate-800">
          <div className="absolute right-3 top-3 rounded-xl bg-rose-50 p-2.5 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">
              Jatuh Tempo (Overdue)
            </CardDescription>
            <CardTitle className="text-xl font-bold text-rose-600 dark:text-rose-400 sm:text-2xl">
              {summaryLoading ? (
                <Skeleton className="h-7 w-32" />
              ) : (
                formatRupiah(summary?.totalOverdueAmount || 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
              <span>
                {summary?.overdueCount || 0} Pelanggan Perlu Dihubungi
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Total Invoices */}
        <Card className="relative overflow-hidden border-slate-200 dark:border-slate-800">
          <div className="absolute right-3 top-3 rounded-xl bg-purple-50 p-2.5 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <FileText className="h-5 w-5" />
          </div>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">
              Total Faktur Diterbitkan
            </CardDescription>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              {summaryLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                `${summary?.totalInvoicesCount || 0} Tagihan`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-medium">
              <span>Semua Periode</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Route Tabs: Invoices & Payments */}
      <RouteTabs items={navTabs} />

      {/* Child Subroute */}
      <div>{children}</div>

      {/* Global Modals for Header Actions */}
      <CreateInvoiceDialog
        customers={customers}
        profiles={profiles}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => refetchAll()}
      />
      <BulkGenerateDialog
        customers={customers}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onSuccess={() => refetchAll()}
      />
    </div>
  );
}
