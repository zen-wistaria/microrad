"use client";

import { Edit, Network, Plus, RefreshCw, Trash2 } from "lucide-react";
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
  useDeleteProfileGroupMutation,
  useProfileGroupsQuery,
} from "@/lib/api/hooks";
import type { ProfileGroup } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

export default function ProfileGroupsPage() {
  const {
    data: groupsRes,
    isLoading,
    refetch,
    isFetching,
  } = useProfileGroupsQuery();
  const deleteMutation = useDeleteProfileGroupMutation();

  const groups = groupsRes?.data || [];
  const [deleteTarget, setDeleteTarget] = useState<ProfileGroup | null>(null);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success(`Profile Group '${deleteTarget.name}' berhasil dihapus`);
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
            Profile Group
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pengelompokan jaringan, asosiasi Router NAS, modul IP pool, gateway,
            dan DNS server.
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
            <Link href="/profile-groups/new">
              <Plus className="h-4 w-4" />
              Tambah Profile Group
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-base">Daftar Profile Group</CardTitle>
            </div>
            <span className="text-xs text-slate-400">
              Total: {groups.length} grup jaringan
            </span>
          </div>
          <CardDescription>
            Grup jaringan yang diasosiasikan ke dalam paket PPP Profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 border-y border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">
                    Nama Profile Group
                  </th>
                  <th className="py-3 px-4 font-semibold">Router NAS</th>
                  <th className="py-3 px-4 font-semibold">Modul IP</th>
                  <th className="py-3 px-4 font-semibold">Local Gateway</th>
                  <th className="py-3 px-4 font-semibold">Rentang IP Pool</th>
                  <th className="py-3 px-4 font-semibold">DNS Server</th>
                  <th className="py-3 px-4 font-semibold">Paket</th>
                  <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td
                        colSpan={8}
                        className="p-4 text-center text-slate-400"
                      >
                        Memuat data profile group...
                      </td>
                    </tr>
                  ))
                ) : groups.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        title="Belum ada Profile Group"
                        description="Buat profile group pertama untuk menghubungkan router dan manajemen IP pool."
                        actionLabel="Tambah Profile Group"
                        onAction={() => {}}
                      />
                    </td>
                  </tr>
                ) : (
                  groups.map((group) => (
                    <tr
                      key={group.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-1.5">
                          <span>{group.name}</span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1 py-0"
                          >
                            {group.type}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {group.nasRouter?.name || "Router NAS"}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            {group.nasRouter?.ipAddress || "-"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            group.ipModule === "sql"
                              ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300"
                              : "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900 dark:bg-purple-950/20 dark:text-purple-300"
                          }`}
                        >
                          {group.ipModule === "sql"
                            ? "SQL IP Module"
                            : "Mikrotik Pool"}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-800 dark:text-slate-200">
                        {group.localAddress}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-700 dark:text-emerald-300">
                        {group.rangeIpStart} - {group.rangeIpEnd}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">
                        {group.dnsServers || "8.8.8.8,8.8.4.4"}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant="secondary"
                          className="font-mono text-xs"
                        >
                          {group.pppProfileCount || 0} paket
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
                            <Link href={`/profile-groups/${group.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(group)}
                            disabled={Boolean(
                              group.pppProfileCount &&
                                group.pppProfileCount > 0,
                            )}
                            className="h-8 w-8 text-slate-500 hover:text-red-600 disabled:opacity-30"
                            title={
                              group.pppProfileCount && group.pppProfileCount > 0
                                ? "Tidak dapat dihapus karena masih digunakan oleh PPP Profile"
                                : "Hapus Profile Group"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus Profile Group"
        description={`Apakah Anda yakin ingin menghapus Profile Group '${deleteTarget?.name}'? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Group"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
