"use client";

import { Edit, Package, Plus, RefreshCw, Trash2, Users } from "lucide-react";
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
  useDeletePppProfileMutation,
  usePppProfilesQuery,
} from "@/lib/api/hooks";
import type { PppProfile } from "@/lib/types";
import { formatRupiah, getErrorMessage } from "@/lib/utils";

export default function PppProfilesPage() {
  const {
    data: profilesRes,
    isLoading,
    refetch,
    isFetching,
  } = usePppProfilesQuery();
  const deleteMutation = useDeletePppProfileMutation();

  const profiles = profilesRes?.data || [];
  const [deleteTarget, setDeleteTarget] = useState<PppProfile | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(`PPP Profile '${deleteTarget.name}' berhasil dihapus`);
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
            PPP Profile (Paket Layanan)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Paket langganan internet PPPoE yang dipilih oleh pelanggan dan
            menghasilkan konfigurasi RADIUS CoA / MikroTik.
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
            <Link href="/ppp-profiles/new">
              <Plus className="h-4 w-4" />
              Tambah PPP Profile
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-base">
                Daftar Paket PPP Profile
              </CardTitle>
            </div>
            <span className="text-xs text-slate-400">
              Total: {profiles.length} paket
            </span>
          </div>
          <CardDescription>
            Paket aktif yang dapat dipilih saat mendaftarkan atau mengedit
            pelanggan.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 border-y border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Nama Paket</th>
                  <th className="py-3 px-4 font-semibold">Harga Bulanan</th>
                  <th className="py-3 px-4 font-semibold">
                    Kecepatan Bandwidth
                  </th>
                  <th className="py-3 px-4 font-semibold">
                    Profile Group (NAS & IP)
                  </th>
                  <th className="py-3 px-4 font-semibold">Priority</th>
                  <th className="py-3 px-4 font-semibold">Pelanggan</th>
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
                        Memuat paket PPP profile...
                      </td>
                    </tr>
                  ))
                ) : profiles.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        title="Belum ada PPP Profile"
                        description="Buat paket langganan PPPoE pertama Anda."
                        actionLabel="Tambah PPP Profile"
                        onAction={() => {}}
                      />
                    </td>
                  </tr>
                ) : (
                  profiles.map((profile) => {
                    const bw = profile.bandwidth;
                    const group = profile.profileGroup;

                    return (
                      <tr
                        key={profile.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                          {profile.name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-blue-700 dark:text-blue-300">
                            {formatRupiah(profile.price)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            /bln
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {bw ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {bw.name}
                              </span>
                              <span className="font-mono text-[11px] text-blue-600">
                                (↓{bw.maxDownload} {bw.maxDownloadUnit} / ↑
                                {bw.maxUpload} {bw.maxUploadUnit})
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {group ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {group.name}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {group.nasRouter?.name} ({group.localAddress})
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant={
                              profile.priority <= 4 ? "default" : "secondary"
                            }
                            className="text-[10px] font-mono"
                          >
                            P{profile.priority || 8}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs gap-1"
                          >
                            <Users className="h-3 w-3" />
                            {profile.customerCount || 0} user
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
                              <Link href={`/ppp-profiles/${profile.id}/edit`}>
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(profile)}
                              disabled={Boolean(
                                profile.customerCount &&
                                  profile.customerCount > 0,
                              )}
                              className="h-8 w-8 text-slate-500 hover:text-red-600 disabled:opacity-30"
                              title={
                                profile.customerCount &&
                                profile.customerCount > 0
                                  ? "Tidak dapat dihapus karena masih digunakan oleh pelanggan aktif"
                                  : "Hapus PPP Profile"
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
        title="Hapus PPP Profile"
        description={`Apakah Anda yakin ingin menghapus PPP Profile '${deleteTarget?.name}'? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Paket"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
