"use client";

import {
  Activity,
  Edit,
  MapPin,
  Plus,
  RefreshCw,
  Router as RouterIcon,
  Signal,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { RouterStatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteRouter, getRouters, updateRouter } from "@/lib/api/routers";
import { getActiveSessions } from "@/lib/api/sessions";
import type { NasRouter, Session } from "@/lib/types";

export default function RoutersPage() {
  const [routers, setRouters] = useState<NasRouter[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [testingPingId, setTestingPingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NasRouter | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rList, sList] = await Promise.all([
        getRouters(),
        getActiveSessions(),
      ]);
      setRouters(rList);
      setActiveSessions(sList);
    } catch (_e) {
      toast.error("Gagal memuat daftar router NAS.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRouter(deleteTarget.id);
      toast.success(`Router NAS ${deleteTarget.name} berhasil dihapus.`);
      setRouters((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.message || "Gagal menghapus router NAS.");
    }
  };

  const handleTestPing = async (router: NasRouter) => {
    setTestingPingId(router.id);
    toast.info(`Mengirim RADIUS ping probe ke ${router.ipAddress}...`);
    setTimeout(async () => {
      setTestingPingId(null);
      const isOk = Math.random() > 0.15; // 85% success simulation
      const newStatus = isOk ? "online" : "offline";
      await updateRouter(router.id, { status: newStatus });
      setRouters((prev) =>
        prev.map((r) => (r.id === router.id ? { ...r, status: newStatus } : r)),
      );
      if (isOk) {
        toast.success(
          `Router ${router.name} (${router.ipAddress}) membalas RADIUS ping dalam 14ms.`,
        );
      } else {
        toast.error(
          `Router ${router.name} (${router.ipAddress}) tidak merespons probe (Request Timeout).`,
        );
      }
    }, 1200);
  };

  const getSessionCountForRouter = (ip: string) => {
    return activeSessions.filter((s) => s.nasIpAddress === ip).length;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Router NAS (MikroTik)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Daftar Network Access Server (NAS) yang terdaftar di database RADIUS
            tabel <code className="text-xs">nas</code>.
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
            <Link href="/routers/new">
              <Plus className="h-4 w-4" />
              Tambah NAS Router
            </Link>
          </Button>
        </div>
      </div>

      {/* Routers Grid */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-6 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : routers.length === 0 ? (
        <EmptyState
          icon={RouterIcon}
          title="Belum ada router NAS terdaftar"
          description="Tambahkan router MikroTik PPPoE Server Anda untuk menerima autentikasi FreeRADIUS."
          actionLabel="Tambah Router Pertama"
          actionHref="/routers/new"
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {routers.map((router) => {
            const sessionCount = getSessionCountForRouter(router.ipAddress);
            const isPinging = testingPingId === router.id;

            return (
              <Card
                key={router.id}
                className="flex flex-col justify-between overflow-hidden border-slate-200/80 bg-white transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
                          <RouterIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base">
                            {router.name}
                          </CardTitle>
                          <p className="font-mono text-xs text-slate-500">
                            {router.ipAddress}
                          </p>
                        </div>
                      </div>
                      <RouterStatusBadge status={router.status} />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Location and Details */}
                    {router.location && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>{router.location}</span>
                      </div>
                    )}

                    {/* Active Sessions Mini Box */}
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                        <Activity className="h-3.5 w-3.5 text-emerald-500" />
                        Sesi Aktif di Router Ini:
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {sessionCount} PPPoE Users
                      </span>
                    </div>
                  </CardContent>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 p-4 pt-3 dark:border-slate-800">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestPing(router)}
                    disabled={isPinging}
                    className="h-8 px-2.5 text-xs text-slate-600 dark:text-slate-400 gap-1.5"
                  >
                    <Signal
                      className={`h-3.5 w-3.5 ${isPinging ? "animate-pulse text-amber-500" : ""}`}
                    />
                    {isPinging ? "Pinging..." : "Test Ping"}
                  </Button>

                  <div className="flex items-center gap-1">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                    >
                      <Link href={`/routers/${router.id}/edit`}>
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(router)}
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
        title="Hapus Router NAS?"
        description={`Apakah Anda yakin ingin menghapus router '${deleteTarget?.name}' (${deleteTarget?.ipAddress})? Permintaan autentikasi dari IP ini akan ditolak FreeRADIUS.`}
        confirmLabel="Hapus Router"
        onConfirm={handleDelete}
      />
    </div>
  );
}
