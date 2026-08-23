"use client";

import {
  AlertCircle,
  AtSign,
  CalendarDays,
  Clock,
  MapPin,
  Phone,
  RefreshCw,
  Router,
  ShieldCheck,
  Zap,
} from "lucide-react";
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
import { usePortal } from "@/lib/portal-context";
import { formatDate, formatRelativeTime, formatRupiah } from "@/lib/utils";

export default function PortalInfoPage() {
  const { data, loading, refreshing, reload } = usePortal();

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        Data pelanggan tidak ditemukan untuk akun ini.
      </div>
    );
  }

  const { customer, profile, summary } = data;

  // Periode/bulan berlangganan yang aktif saat ini — dari invoice periode
  // bulan berjalan (mock dibuat dinamis), fallback ke tanggal sekarang.
  const now = new Date();
  const activeInvoice = data.invoices.find(
    (inv) =>
      inv.periodYear === now.getFullYear() &&
      inv.periodMonth === now.getMonth() + 1,
  );
  const periodLabel = activeInvoice
    ? `${now.toLocaleDateString("id-ID", { month: "long" })} ${now.getFullYear()}`
    : `${now.toLocaleDateString("id-ID", { month: "long" })} ${now.getFullYear()}`;

  const infoItems = [
    {
      icon: AtSign,
      label: "Username PPPoE",
      value: customer.username,
      mono: true,
    },
    {
      icon: Phone,
      label: "Nomor Telepon",
      value: customer.phone || "-",
    },
    {
      icon: MapPin,
      label: "Alamat",
      value: customer.address || "-",
    },
    {
      icon: CalendarDays,
      label: "Terdaftar Sejak",
      value: formatDate(customer.createdAt),
    },
    {
      icon: Clock,
      label: "Terakhir Terhubung",
      value: customer.lastSeenAt
        ? formatRelativeTime(customer.lastSeenAt)
        : "Belum pernah",
    },
    {
      icon: Router,
      label: "Status Akun",
      value: (
        <CustomerStatusBadge
          status={customer.status}
          isOnline={summary.onlineNow}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white">
            {customer.fullName?.charAt(0) || customer.username.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {customer.fullName || customer.username}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {data.profile ? `Paket ${data.profile.name}` : "Belum ada paket"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      {/* Alert jika status suspended */}
      {customer.status === "suspended" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">
                Status Layanan: Ditangguhkan (Suspended / Isolir)
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                Koneksi internet Anda sedang dalam masa penangguhan (isolir).
                Silakan lakukan pelunasan tagihan pada menu Tagihan atau hubungi
                customer service kami.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ringkasan layanan & keuangan */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-slate-500">Status Layanan</p>
            <CustomerStatusBadge
              status={customer.status}
              isOnline={summary.onlineNow}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-slate-500">
              Tagihan Berjalan
            </p>
            <p className="mt-1.5 text-lg font-bold text-amber-600 dark:text-amber-400">
              {summary.activeInvoiceCount}
            </p>
            <p className="text-[11px] text-slate-400">
              {formatRupiah(summary.totalOutstandingAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-slate-500">
              Total Sudah Dibayar
            </p>
            <p className="mt-1.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {formatRupiah(summary.totalPaidAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detail paket */}
      {profile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Detail Paket Internet
            </CardTitle>
            <CardDescription>
              {customer.status === "active"
                ? "Informasi paket langganan yang sedang aktif"
                : customer.status === "suspended"
                  ? "Layanan paket internet sedang ditangguhkan (Suspended/Isolir)"
                  : "Layanan paket internet telah dinonaktifkan (Disabled)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-[11px] text-slate-500">Nama Paket</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {profile.name}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Kecepatan Download</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {profile.bandwidth
                  ? `${profile.bandwidth.maxDownload} ${profile.bandwidth.maxDownloadUnit}`
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Kecepatan Upload</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {profile.bandwidth
                  ? `${profile.bandwidth.maxUpload} ${profile.bandwidth.maxUploadUnit}`
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Harga Bulanan</p>
              <p className="mt-0.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {formatRupiah(profile.price || 0)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">
                Periode Aktif (Bulan Ini)
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {periodLabel}
              </p>
            </div>
            {customer.profileGroup && (
              <div className="sm:col-span-2 lg:col-span-4">
                <p className="text-[11px] text-slate-500">
                  Wilayah Layanan (Profile Group)
                </p>
                <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
                  {customer.profileGroup.name}
                  {customer.profileGroup.description
                    ? ` — ${customer.profileGroup.description}`
                    : ""}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informasi pelanggan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Informasi Pelanggan
          </CardTitle>
          <CardDescription>
            Data identitas yang terdaftar di sistem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {infoItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-start gap-3 rounded-lg border border-slate-100 p-3 dark:border-slate-800"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500">{item.label}</p>
                    <div
                      className={
                        item.mono
                          ? "mt-0.5 break-all font-mono text-sm font-semibold text-slate-900 dark:text-slate-100"
                          : "mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100"
                      }
                    >
                      {item.value}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
