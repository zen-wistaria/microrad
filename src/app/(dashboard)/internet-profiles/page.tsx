"use client";

import {
  Edit,
  Package,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
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
  useDeleteInternetProfileMutation,
  useInternetProfilesQuery,
} from "@/lib/api/hooks";
import { formatBandwidthRateLimit } from "@/lib/radius-format";
import type { InternetProfile } from "@/lib/types";
import { formatRupiah, getErrorMessage } from "@/lib/utils";

export default function InternetProfilesPage() {
  const {
    data: profilesRes,
    isLoading,
    refetch,
    isFetching,
  } = useInternetProfilesQuery();
  const deleteMutation = useDeleteInternetProfileMutation();

  const profiles = profilesRes?.data || [];
  const [deleteTarget, setDeleteTarget] = useState<InternetProfile | null>(
    null,
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(`Paket Internet '${deleteTarget.name}' berhasil dihapus`);
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Paket Internet
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Produk paket langganan internet, alokasi bandwidth, tarif bulanan,
            dan prioritas antrean.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`}
            />
            Muat Ulang
          </Button>
          <Button size="sm" asChild>
            <Link href="/internet-profiles/new">
              <Plus className="h-4 w-4 mr-1.5" />
              Tambah Paket
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" />
            Daftar Paket Internet
          </CardTitle>
          <CardDescription>
            Paket yang aktif dan dapat dipilih saat mendaftarkan pelanggan baru.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2 py-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg"
                />
              ))}
            </div>
          ) : profiles.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Belum ada Paket Internet"
              description="Buat paket langganan pertama Anda untuk mulai mendaftarkan pelanggan."
              actionLabel="Tambah Paket Sekarang"
              actionHref="/internet-profiles/new"
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Nama Paket</th>
                    <th className="px-4 py-3">Kecepatan (Bandwidth)</th>
                    <th className="px-4 py-3">Tarif Bulanan</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Pelanggan</th>
                    <th className="px-4 py-3">RADIUS Atribut</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {profiles.map((p) => {
                    const bw = p.bandwidth;
                    const rateLimit = bw
                      ? formatBandwidthRateLimit(bw, p.priority)
                      : "-";

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                          {p.name}
                        </td>
                        <td className="px-4 py-3">
                          {bw ? (
                            <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                              <Zap className="h-3.5 w-3.5 text-amber-500" />
                              <span>
                                ↓{bw.maxDownload} {bw.maxDownloadUnit} / ↑
                                {bw.maxUpload} {bw.maxUploadUnit}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">
                              Tidak ada bandwidth
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatRupiah(p.price)}
                          <span className="text-[11px] font-normal text-slate-400">
                            /bln
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs"
                          >
                            P{p.priority || 8}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="secondary"
                            className="flex items-center gap-1 w-fit"
                          >
                            <Users className="h-3 w-3 text-slate-500" />
                            <span>{p.customerCount ?? 0}</span>
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className="font-mono text-xs text-slate-600 dark:text-slate-400 max-w-[200px] truncate block"
                            title={rateLimit}
                          >
                            {rateLimit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                              asChild
                            >
                              <Link href={`/internet-profiles/${p.id}/edit`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus Paket Internet?"
        description={`Apakah Anda yakin ingin menghapus paket '${deleteTarget?.name}'? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Paket"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
