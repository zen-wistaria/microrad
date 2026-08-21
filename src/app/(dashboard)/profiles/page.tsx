"use client";

import {
  ArrowDown,
  ArrowUp,
  Code2,
  Edit,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteProfile, getProfiles } from "@/lib/api/profiles";
import type { BandwidthProfile } from "@/lib/types";
import { formatRupiah, getErrorMessage } from "@/lib/utils";

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<BandwidthProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<BandwidthProfile | null>(
    null,
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const profList = await getProfiles();
      setProfiles(profList);
    } catch {
      toast.error("Gagal memuat profil bandwidth.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProfile(deleteTarget.id);
      toast.success(`Profil ${deleteTarget.name} berhasil dihapus.`);
      setProfiles((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menghapus profil.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Profil Paket Bandwidth
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Konfigurasi kecepatan upload/download PPPoE yang dipush via RADIUS{" "}
            <code className="text-xs">radgroupreply</code>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="gap-1.5 text-xs text-slate-600 dark:text-slate-400"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button asChild size="sm" className="gap-1.5 text-xs shadow-sm">
            <Link href="/profiles/new">
              <Plus className="h-4 w-4" />
              Tambah Profil Baru
            </Link>
          </Button>
        </div>
      </div>

      {/* Profiles Grid */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-6 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Belum ada profil bandwidth"
          description="Buat profil kecepatan internet baru untuk mulai mendaftarkan paket ke pelanggan."
          actionLabel="Tambah Profil Pertama"
          actionHref="/profiles/new"
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => {
            const count = profile.customerCount ?? 0;

            return (
              <Card
                key={profile.id}
                className="flex flex-col justify-between overflow-hidden border-slate-200/80 bg-white transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                          <Zap className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {profile.name}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {count} Pelanggan Terdaftar
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Rate Limit Stats Box */}
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                      <div className="space-y-0.5">
                        <span className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                          <ArrowDown className="h-3 w-3" />
                          Download
                        </span>
                        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {profile.rateLimitDown}{" "}
                          <span className="text-xs font-normal text-slate-500">
                            Mbps
                          </span>
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <span className="flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                          <ArrowUp className="h-3 w-3" />
                          Upload
                        </span>
                        <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {profile.rateLimitUp}{" "}
                          <span className="text-xs font-normal text-slate-500">
                            Mbps
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Monthly Price */}
                    <div className="flex items-center justify-between rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-3 py-2.5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        <Wallet className="h-3 w-3" />
                        Harga Bulanan
                      </span>
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        {formatRupiah(profile.price || 0)}
                      </span>
                    </div>

                    {/* RADIUS Attribute Preview */}
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-2.5 dark:border-slate-800 dark:bg-slate-950/50">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1">
                        <Code2 className="h-3 w-3" />
                        Mikrotik-Rate-Limit Attribute
                      </div>
                      <code className="text-[11px] font-mono leading-relaxed text-purple-600 dark:text-purple-400">
                        {profile.rateLimitDown}M/{profile.rateLimitUp}M
                        {profile.burstLimitDown || profile.burstLimitUp
                          ? ` ${profile.burstLimitDown || profile.rateLimitDown * 1000}/${profile.burstLimitUp || profile.rateLimitUp * 1000}`
                          : ""}
                        {profile.burstThresholdDown || profile.burstThresholdUp
                          ? ` ${profile.burstThresholdDown || profile.rateLimitDown * 1000}/${profile.burstThresholdUp || profile.rateLimitUp * 1000}`
                          : ""}
                        {profile.burstTimeSeconds
                          ? ` ${profile.burstTimeSeconds}/${profile.burstTimeSeconds}`
                          : ""}
                        {profile.priority ? ` ${profile.priority}` : ""}
                        {profile.limitAtDown || profile.limitAtUp
                          ? ` ${profile.limitAtDown || profile.rateLimitDown * 1000}/${profile.limitAtUp || profile.rateLimitUp * 1000}`
                          : ""}
                      </code>
                    </div>
                    {(profile.burstLimitDown ||
                      profile.burstLimitUp ||
                      profile.burstTimeSeconds ||
                      profile.priority ||
                      profile.limitAtDown ||
                      profile.limitAtUp) && (
                      <div className="flex flex-wrap gap-1.5">
                        {profile.burstTimeSeconds && (
                          <span className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950/50 dark:text-purple-400">
                            Burst {profile.burstTimeSeconds}s
                          </span>
                        )}
                        {profile.priority && (
                          <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-950/50 dark:text-orange-400">
                            Prioritas {profile.priority}
                          </span>
                        )}
                        {(profile.limitAtDown || profile.limitAtUp) && (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                            Limit-at {profile.limitAtDown || 0}/
                            {profile.limitAtUp || 0}k
                          </span>
                        )}
                      </div>
                    )}

                    {profile.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {profile.description}
                      </p>
                    )}
                  </CardContent>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 p-4 pt-3 dark:border-slate-800">
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Users className="h-3.5 w-3.5" />
                    {count} Users
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                    >
                      <Link href={`/profiles/${profile.id}/edit`}>
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(profile)}
                      className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Hapus
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Hapus Profil Paket?"
        description={`Apakah Anda yakin ingin menghapus profil '${deleteTarget?.name}'? Tindakan ini tidak dapat dibatalkan jika masih ada pelanggan yang terhubung.`}
        confirmLabel="Hapus Profil"
        onConfirm={handleDelete}
      />
    </div>
  );
}
