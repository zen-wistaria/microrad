"use client";

import { AlertCircle, Ban, CheckCircle2, Shield, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatRelativeTime, formatRupiah } from "@/lib/utils";
import { useCustomerDetail } from "../customer-detail-context";

export default function CustomerOverviewPage() {
  const { customer, profile, profileGroup, activeSession } =
    useCustomerDetail();

  if (!customer) return null;
  const isOnline = Boolean(activeSession && !activeSession.stoppedAt);

  return (
    <div className="space-y-6 pt-2">
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
            {profileGroup && (
              <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500">Wilayah (Profile Group):</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {profileGroup.name} ({profileGroup.pppProfiles?.length || 0}{" "}
                  Router Node)
                </span>
              </div>
            )}
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500">IP Statis (Framed-IP):</span>
              <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                {customer.staticIp || (
                  <span className="text-slate-400 italic">Dynamic Pool</span>
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
                    Multi Session (Maks {customer.maxSimultaneous || 2} Sesi)
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
              <span className="text-slate-500">Router Node (Wilayah):</span>
              <div className="text-right">
                {profileGroup ? (
                  <Badge
                    variant="outline"
                    className="text-indigo-600 border-indigo-200 text-[11px]"
                  >
                    {profileGroup.name} ({profileGroup.routers?.length || 1}{" "}
                    Router)
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-slate-500 text-[11px]"
                  >
                    Bebas / Tanpa Wilayah
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
                  <span className="text-slate-400 italic">Belum Terdaftar</span>
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
    </div>
  );
}
