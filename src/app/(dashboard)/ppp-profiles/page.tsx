"use client";

import {
  Edit,
  Network,
  Plus,
  Radio,
  RefreshCw,
  Router as RouterIcon,
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
  useDeletePppProfileMutation,
  usePppProfilesQuery,
} from "@/lib/api/hooks";
import type { PppProfile } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

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
            PPP Profile (Node MikroTik)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Konfigurasi gateway PPP, IP Pool, dan DNS pada masing-masing Router
            MikroTik.
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
            <Link href="/ppp-profiles/new">
              <Plus className="h-4 w-4 mr-1.5" />
              Tambah PPP Profile
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-4 w-4 text-blue-600" />
            Daftar PPP Profile Node
          </CardTitle>
          <CardDescription>
            Konfigurasi interface PPP yang diterapkan pada router target.
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
              icon={Radio}
              title="Belum ada PPP Profile"
              description="Konfigurasikan gateway dan IP pool router pertama Anda."
              actionLabel="Tambah PPP Profile"
              actionHref="/ppp-profiles/new"
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Nama Profile</th>
                    <th className="px-4 py-3">Router NAS Target</th>
                    <th className="px-4 py-3">Local Address (Gateway)</th>
                    <th className="px-4 py-3">Range IP Pool Client</th>
                    <th className="px-4 py-3">Profile Group (Wilayah)</th>
                    <th className="px-4 py-3">IP Module</th>
                    <th className="px-4 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {profiles.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                        {p.name}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <RouterIcon className="h-3.5 w-3.5 text-indigo-500" />
                          <span className="font-medium">
                            {p.nasRouter?.name || p.nasId}
                          </span>
                          <span className="font-mono text-[11px] text-slate-400">
                            ({p.nasRouter?.ipAddress || "-"})
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                        {p.localAddress}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                        {p.rangeIpStart} - {p.rangeIpEnd}
                      </td>
                      <td className="px-4 py-3">
                        {p.profileGroup ? (
                          <Badge
                            variant="secondary"
                            className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 flex items-center gap-1 w-fit"
                          >
                            <Network className="h-3 w-3" />
                            {p.profileGroup.name}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs italic">
                            Tanpa Group
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">
                          {p.ipModule === "sql"
                            ? "FreeRADIUS SQL"
                            : "MikroTik Pool"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                            asChild
                          >
                            <Link href={`/ppp-profiles/${p.id}/edit`}>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus PPP Profile?"
        description={`Apakah Anda yakin ingin menghapus PPP Profile '${deleteTarget?.name}'? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus Profile"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
