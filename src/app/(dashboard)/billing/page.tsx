"use client";

import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  MessageSquare,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BulkGenerateDialog } from "@/components/billing/bulk-generate-dialog";
import { CreateInvoiceDialog } from "@/components/billing/create-invoice-dialog";
import { PaymentDialog } from "@/components/billing/payment-dialog";
import { ReminderDialog } from "@/components/billing/reminder-dialog";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
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
import { Input } from "@/components/ui/input";
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
  deleteInvoice,
  getBillingSummary,
  getInvoices,
  getPayments,
} from "@/lib/api/billing";
import { getCustomers } from "@/lib/api/customers";
import { getProfiles } from "@/lib/api/profiles";
import type {
  BandwidthProfile,
  BillingSummary,
  Customer,
  Invoice,
  PaymentRecord,
} from "@/lib/types";
import { formatDate, formatRupiah } from "@/lib/utils";

function BillingContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("search") || "";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [profiles, setProfiles] = useState<BandwidthProfile[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState(initialQuery);
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("invoices");

  // Dialog states
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [reminderTarget, setReminderTarget] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invList, payList, custList, profList, sumData] = await Promise.all(
        [
          getInvoices(),
          getPayments(),
          getCustomers(),
          getProfiles(),
          getBillingSummary(),
        ],
      );
      setInvoices(invList);
      setPayments(payList);
      setCustomers(custList);
      setProfiles(profList);
      setSummary(sumData);
    } catch {
      toast.error("Gagal memuat data billing & tagihan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (initialQuery) {
      setSearch(initialQuery);
    }
  }, [initialQuery]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchSearch =
        search === "" ||
        inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
        inv.customerUsername.toLowerCase().includes(search.toLowerCase()) ||
        inv.customerFullName?.toLowerCase().includes(search.toLowerCase()) ||
        inv.customerPhone?.includes(search);

      const matchStatus = statusFilter === "all" || inv.status === statusFilter;
      const matchMonth =
        monthFilter === "all" || String(inv.periodMonth) === monthFilter;

      return matchSearch && matchStatus && matchMonth;
    });
  }, [invoices, search, statusFilter, monthFilter]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteInvoice(deleteTarget.id);
      toast.success(`Invoice ${deleteTarget.invoiceNumber} berhasil dihapus.`);
      setInvoices((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
      const sumData = await getBillingSummary();
      setSummary(sumData);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus invoice");
    }
  };

  const handlePaymentSuccess = async (updatedInvoice: Invoice) => {
    setInvoices((prev) =>
      prev.map((i) => (i.id === updatedInvoice.id ? updatedInvoice : i)),
    );
    const [payList, sumData] = await Promise.all([
      getPayments(),
      getBillingSummary(),
    ]);
    setPayments(payList);
    setSummary(sumData);
  };

  const handleBulkSuccess = async (allInvoices: Invoice[]) => {
    setInvoices(allInvoices);
    const sumData = await getBillingSummary();
    setSummary(sumData);
  };

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
            onClick={fetchData}
            className="gap-1.5 text-xs text-slate-600 dark:text-slate-400"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setBulkOpen(true)}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Zap className="h-4 w-4 text-amber-500" />
            Generate Massal
          </Button>

          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="gap-1.5 text-xs shadow-sm bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4" />
            Buat Tagihan Baru
          </Button>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Revenue this month */}
        <Card className="relative overflow-hidden border-slate-200 dark:border-slate-800">
          <div className="absolute right-3 top-3 rounded-xl bg-emerald-50 p-2.5 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <DollarSign className="h-5 w-5" />
          </div>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">
              Pendapatan Bulan Ini
            </CardDescription>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">
              {loading ? (
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
              {loading ? (
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
              {loading ? (
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
              {loading ? (
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

      {/* Main Tabs Container */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100 dark:bg-slate-800">
          <TabsTrigger value="invoices" className="gap-2">
            <Receipt className="h-4 w-4" />
            <span>Daftar Tagihan</span>
            <span className="ml-1 rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 text-[10px] font-bold">
              {invoices.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Riwayat Pembayaran</span>
            <span className="ml-1 rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 py-0.2 text-[10px] font-bold">
              {payments.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Invoices List */}
        <TabsContent value="invoices" className="space-y-4 pt-2">
          {/* Filters Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Cari nomor tagihan, username, nama pelanggan..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 text-xs"
                  />
                </div>

                {/* Status & Month Filter */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="w-40">
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Status Tagihan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Status</SelectItem>
                        <SelectItem value="unpaid">Belum Bayar</SelectItem>
                        <SelectItem value="paid">Lunas</SelectItem>
                        <SelectItem value="overdue">Jatuh Tempo</SelectItem>
                        <SelectItem value="cancelled">Dibatalkan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-36">
                    <Select value={monthFilter} onValueChange={setMonthFilter}>
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue placeholder="Bulan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Bulan</SelectItem>
                        <SelectItem value="8">Agustus</SelectItem>
                        <SelectItem value="7">Juli</SelectItem>
                        <SelectItem value="6">Juni</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(search ||
                    statusFilter !== "all" ||
                    monthFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("all");
                        setMonthFilter("all");
                      }}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoices Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">No. Invoice</th>
                      <th className="py-3 px-4 font-semibold">Pelanggan</th>
                      <th className="py-3 px-4 font-semibold">
                        Paket & Periode
                      </th>
                      <th className="py-3 px-4 font-semibold">Total Tagihan</th>
                      <th className="py-3 px-4 font-semibold">Jatuh Tempo</th>
                      <th className="py-3 px-4 font-semibold">Status</th>
                      <th className="py-3 px-4 font-semibold">Metode</th>
                      <th className="py-3 px-4 font-semibold text-right">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td colSpan={8} className="p-4">
                            <Skeleton className="h-5 w-full" />
                          </td>
                        </tr>
                      ))
                    ) : filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12">
                          <EmptyState
                            icon={Receipt}
                            title="Tidak ada data tagihan"
                            description="Belum ada tagihan yang cocok dengan filter atau kriteria pencarian."
                            actionLabel="Buat Tagihan Baru"
                            onAction={() => setCreateOpen(true)}
                          />
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((inv) => (
                        <tr
                          key={inv.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono font-semibold text-blue-600 dark:text-blue-400">
                            <Link
                              href={`/billing/${inv.id}`}
                              className="hover:underline flex items-center gap-1"
                            >
                              <span>{inv.invoiceNumber}</span>
                              <ArrowUpRight className="h-3 w-3 opacity-60" />
                            </Link>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {inv.customerFullName || inv.customerUsername}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              @{inv.customerUsername}{" "}
                              {inv.customerPhone
                                ? `• ${inv.customerPhone}`
                                : ""}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              {inv.profileName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Bulan {inv.periodMonth}/{inv.periodYear}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                            {formatRupiah(inv.totalAmount)}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                            {formatDate(inv.dueDate)}
                          </td>
                          <td className="py-3.5 px-4">
                            <InvoiceStatusBadge status={inv.status} />
                          </td>
                          <td className="py-3.5 px-4">
                            <PaymentMethodBadge method={inv.paymentMethod} />
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* If not paid, show Pay button */}
                              {inv.status !== "paid" && (
                                <Button
                                  variant="success"
                                  size="xs"
                                  onClick={() => setPaymentTarget(inv)}
                                  title="Tandai Pembayaran Lunas"
                                  className="h-7 px-2.5 text-xs shadow-xs font-medium"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                  Bayar
                                </Button>
                              )}

                              {/* WhatsApp Reminder */}
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => setReminderTarget(inv)}
                                title="Kirim Pengingat WhatsApp"
                                className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 p-0"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                              </Button>

                              {/* Detail / Print */}
                              <Button
                                asChild
                                variant="ghost"
                                size="xs"
                                className="h-7 w-7 text-slate-600 hover:text-slate-900 p-0"
                                title="Cetak / Detail Invoice"
                              >
                                <Link href={`/billing/${inv.id}`}>
                                  <Printer className="h-3.5 w-3.5" />
                                </Link>
                              </Button>

                              {/* Delete */}
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => setDeleteTarget(inv)}
                                title="Hapus Invoice"
                                className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 p-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
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

        {/* Tab 2: Payment Records History */}
        <TabsContent value="payments" className="space-y-4 pt-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Riwayat Transaksi & Pembayaran Masuk
              </CardTitle>
              <CardDescription className="text-xs">
                Log real-time seluruh pembayaran invoice yang berhasil
                diverifikasi.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">
                        ID Transaksi / Ref
                      </th>
                      <th className="py-3 px-4 font-semibold">No. Invoice</th>
                      <th className="py-3 px-4 font-semibold">Pelanggan</th>
                      <th className="py-3 px-4 font-semibold">Nominal Masuk</th>
                      <th className="py-3 px-4 font-semibold">
                        Metode Pembayaran
                      </th>
                      <th className="py-3 px-4 font-semibold">
                        Waktu Pembayaran
                      </th>
                      <th className="py-3 px-4 font-semibold">Diterima Oleh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {payments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-slate-400"
                        >
                          Belum ada data transaksi pembayaran.
                        </td>
                      </tr>
                    ) : (
                      payments.map((p) => (
                        <tr
                          key={p.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {p.paymentReference || p.id}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-blue-600 dark:text-blue-400">
                            <Link
                              href={`/billing/${p.invoiceId}`}
                              className="hover:underline"
                            >
                              {p.invoiceNumber}
                            </Link>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                            {p.customerName}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-emerald-600 dark:text-emerald-400">
                            {formatRupiah(p.amount)}
                          </td>
                          <td className="py-3.5 px-4">
                            <PaymentMethodBadge method={p.paymentMethod} />
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                            {formatDate(p.paidAt)}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500">
                            {p.receivedBy}
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

      {/* Payment Processing Dialog */}
      <PaymentDialog
        invoice={paymentTarget}
        open={Boolean(paymentTarget)}
        onOpenChange={(open) => !open && setPaymentTarget(null)}
        onSuccess={handlePaymentSuccess}
      />

      {/* WhatsApp Reminder Dialog */}
      <ReminderDialog
        invoice={reminderTarget}
        open={Boolean(reminderTarget)}
        onOpenChange={(open) => !open && setReminderTarget(null)}
      />

      {/* Create Manual Invoice Dialog */}
      <CreateInvoiceDialog
        customers={customers}
        profiles={profiles}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={(newInv) => {
          setInvoices((prev) => [newInv, ...prev]);
          getBillingSummary().then(setSummary);
        }}
      />

      {/* Bulk Generate Invoices Dialog */}
      <BulkGenerateDialog
        customers={customers}
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onSuccess={handleBulkSuccess}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus Invoice Tagihan?"
        description={`Apakah Anda yakin ingin menghapus faktur tagihan '${deleteTarget?.invoiceNumber}' untuk pelanggan ${deleteTarget?.customerFullName || deleteTarget?.customerUsername}?`}
        confirmLabel="Hapus Invoice"
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8">
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}
