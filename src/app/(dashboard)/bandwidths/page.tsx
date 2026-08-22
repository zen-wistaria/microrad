"use client";

import {
  ArrowDown,
  ArrowUp,
  Edit,
  Flame,
  Gauge,
  Plus,
  RefreshCw,
  Trash2,
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
  useBandwidthsQuery,
  useDeleteBandwidthMutation,
} from "@/lib/api/hooks";
import { formatBandwidthRateLimit } from "@/lib/radius-format";
import type { Bandwidth } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

export default function BandwidthsPage() {
  const { data: bwsRes, isLoading, refetch, isFetching } = useBandwidthsQuery();
  const deleteMutation = useDeleteBandwidthMutation();

  const bandwidths = bwsRes?.data || [];
  const [deleteTarget, setDeleteTarget] = useState<Bandwidth | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(
        `Konfigurasi bandwidth '${deleteTarget.name}' berhasil dihapus`,
      );
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
            Konfigurasi Bandwidth
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manajemen batas kecepatan download/upload (MIR), garansi kecepatan
            (CIR), dan konfigurasi burst QoS.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-1.5 text-xs text-slate-600 dark:text-slate-400"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button asChild size="sm" className="gap-1.5 text-xs shadow-sm">
            <Link href="/bandwidths/new">
              <Plus className="h-4 w-4" />
              Tambah Bandwidth
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-base">
                Daftar Konfigurasi Bandwidth
              </CardTitle>
            </div>
            <span className="text-xs text-slate-400">
              Total: {bandwidths.length} konfigurasi
            </span>
          </div>
          <CardDescription>
            Pilihan kecepatan yang dapat diasosiasikan ke dalam PPP Profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 border-y border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Nama Bandwidth</th>
                  <th className="py-3 px-4 font-semibold">
                    Kecepatan Puncak (MIR)
                  </th>
                  <th className="py-3 px-4 font-semibold">Garansi Min (CIR)</th>
                  <th className="py-3 px-4 font-semibold">Burst QoS</th>
                  <th className="py-3 px-4 font-semibold">Format Rate-Limit</th>
                  <th className="py-3 px-4 font-semibold">Dipakai</th>
                  <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td
                        colSpan={7}
                        className="p-4 text-center text-slate-400"
                      >
                        Memuat data bandwidth...
                      </td>
                    </tr>
                  ))
                ) : bandwidths.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        title="Belum ada konfigurasi bandwidth"
                        description="Tambahkan konfigurasi kecepatan download dan upload pertama Anda."
                        actionLabel="Tambah Bandwidth"
                        onAction={() => {}}
                      />
                    </td>
                  </tr>
                ) : (
                  bandwidths.map((bw) => {
                    const hasBurst = Boolean(
                      bw.burstLimitDownload &&
                        bw.burstLimitUpload &&
                        bw.burstThresholdDownload &&
                        bw.burstThresholdUpload &&
                        bw.burstTime,
                    );
                    const rateString = formatBandwidthRateLimit(bw, 8);

                    return (
                      <tr
                        key={bw.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {bw.name}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center text-blue-600 font-mono">
                              <ArrowDown className="h-3 w-3 mr-0.5" />
                              {bw.maxDownload} {bw.maxDownloadUnit}
                            </span>
                            <span className="text-slate-300">/</span>
                            <span className="inline-flex items-center text-emerald-600 font-mono">
                              <ArrowUp className="h-3 w-3 mr-0.5" />
                              {bw.maxUpload} {bw.maxUploadUnit}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono">
                          {bw.minDownload ? (
                            <span>
                              ↓{bw.minDownload} {bw.minDownloadUnit} / ↑
                              {bw.minUpload} {bw.minUploadUnit}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {hasBurst ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-300 font-mono text-[10px]"
                            >
                              <Flame className="h-2.5 w-2.5" />
                              {bw.burstLimitDownload}
                              {bw.burstLimitDownloadUnit}/{bw.burstTime}s
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-xs">
                              Non-aktif
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {rateString}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs"
                          >
                            {bw.pppProfileCount || 0} paket
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:text-blue-600"
                            >
                              <Link href={`/bandwidths/${bw.id}/edit`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(bw)}
                              disabled={Boolean(
                                bw.pppProfileCount && bw.pppProfileCount > 0,
                              )}
                              className="h-8 w-8 text-slate-500 hover:text-red-600 disabled:opacity-30"
                              title={
                                bw.pppProfileCount && bw.pppProfileCount > 0
                                  ? "Tidak dapat dihapus karena masih dipakai oleh PPP Profile"
                                  : "Hapus Bandwidth"
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus Konfigurasi Bandwidth"
        description={`Apakah Anda yakin ingin menghapus konfigurasi bandwidth '${deleteTarget?.name}'? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Bandwidth"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
