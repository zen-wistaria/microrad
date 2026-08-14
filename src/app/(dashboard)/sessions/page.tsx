"use client";

import {
  Activity,
  Download,
  PowerOff,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LiveDurationCounter } from "@/components/common/live-counter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getRouters } from "@/lib/api/routers";
import { disconnectSession, getActiveSessions } from "@/lib/api/sessions";
import type { NasRouter, Session } from "@/lib/types";
import { formatBytes, getErrorMessage } from "@/lib/utils";

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [routers, setRouters] = useState<NasRouter[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Search & Filter
  const [search, setSearch] = useState("");
  const [routerFilter, setRouterFilter] = useState("all");

  // Disconnect Target
  const [disconnectSessionTarget, setDisconnectSessionTarget] =
    useState<Session | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [sessList, routerList] = await Promise.all([
        getActiveSessions(),
        getRouters(),
      ]);
      setSessions(sessList);
      setRouters(routerList);
    } catch (e) {
      console.error(e);
      toast.error("Gagal memperbarui sesi aktif.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Polling interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchData();
    }, 6000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  const handleDisconnect = async () => {
    if (!disconnectSessionTarget) return;
    try {
      await disconnectSession(disconnectSessionTarget.id);
      toast.success(
        `Sesi untuk ${disconnectSessionTarget.customerUsername} (${disconnectSessionTarget.framedIp}) berhasil diputuskan.`,
      );
      setSessions((prev) =>
        prev.filter((s) => s.id !== disconnectSessionTarget.id),
      );
      setDisconnectSessionTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal memutuskan sesi PPPoE.");
    }
  };

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchSearch =
        search === "" ||
        s.customerUsername.toLowerCase().includes(search.toLowerCase()) ||
        s.framedIp?.includes(search) ||
        s.nasIpAddress.includes(search);

      const matchRouter =
        routerFilter === "all" || s.nasIpAddress === routerFilter;

      return matchSearch && matchRouter;
    });
  }, [sessions, search, routerFilter]);

  // Aggregate KPI Stats
  const totalDownloadActive = useMemo(
    () => sessions.reduce((acc, s) => acc + s.outputBytes, 0),
    [sessions],
  );
  const totalUploadActive = useMemo(
    () => sessions.reduce((acc, s) => acc + s.inputBytes, 0),
    [sessions],
  );
  const _uniqueNasCount = useMemo(
    () => new Set(sessions.map((s) => s.nasIpAddress)).size,
    [sessions],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
              Sesi Aktif Realtime
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {sessions.length} Online
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitoring koneksi PPPoE aktif dari seluruh router MikroTik melalui
            FreeRADIUS Accounting.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`gap-1.5 text-xs ${autoRefresh ? "text-emerald-600 border-emerald-300 dark:border-emerald-800" : "text-slate-500"}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}
            />
            Auto-refresh: {autoRefresh ? "Aktif (6s)" : "Mati"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="gap-1.5 text-xs text-slate-600 dark:text-slate-400"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">
                Sesi Pelanggan Aktif
              </p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {sessions.length} Pelanggan
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                Total Download Sesi Aktif
              </p>
              <h3 className="mt-1 text-2xl font-bold text-blue-950 dark:text-blue-100">
                {formatBytes(totalDownloadActive)}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Download className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                Total Upload Sesi Aktif
              </p>
              <h3 className="mt-1 text-2xl font-bold text-indigo-950 dark:text-indigo-100">
                {formatBytes(totalUploadActive)}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <Upload className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari username pelanggan, framed IP, atau NAS IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs sm:text-sm"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-56">
                <Select value={routerFilter} onValueChange={setRouterFilter}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Pilih NAS Router" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Router NAS</SelectItem>
                    {routers.map((r) => (
                      <SelectItem key={r.id} value={r.ipAddress}>
                        {r.name} ({r.ipAddress})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(search || routerFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setRouterFilter("all");
                  }}
                  className="text-xs text-slate-500"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Pelanggan PPPoE</th>
                  <th className="py-3 px-4 font-semibold">Framed IP Address</th>
                  <th className="py-3 px-4 font-semibold">
                    NAS Router (MikroTik)
                  </th>
                  <th className="py-3 px-4 font-semibold">Durasi Online</th>
                  <th className="py-3 px-4 font-semibold">Download</th>
                  <th className="py-3 px-4 font-semibold">Upload</th>
                  <th className="py-3 px-4 font-semibold text-right">
                    Aksi Disconnect
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="p-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12">
                      <EmptyState
                        icon={Activity}
                        title="Tidak ada sesi aktif"
                        description={
                          search || routerFilter !== "all"
                            ? "Tidak ada sesi yang sesuai dengan kriteria pencarian Anda."
                            : "Saat ini tidak ada pelanggan PPPoE yang sedang terhubung online."
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((session) => {
                    const routerObj = routers.find(
                      (r) => r.ipAddress === session.nasIpAddress,
                    );

                    return (
                      <tr
                        key={session.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          <Link
                            href={`/customers/${session.customerId}`}
                            className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline flex items-center gap-1.5"
                          >
                            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                            {session.customerUsername}
                          </Link>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono dark:bg-slate-800">
                            {session.framedIp || "-"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {routerObj?.name || session.nasIpAddress}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400">
                            {session.nasIpAddress}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <LiveDurationCounter
                            startedAt={session.startedAt}
                            showIcon={true}
                          />
                        </td>
                        <td className="py-3.5 px-4 font-medium text-blue-600 dark:text-blue-400">
                          {formatBytes(session.outputBytes)}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-indigo-600 dark:text-indigo-400">
                          {formatBytes(session.inputBytes)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDisconnectSessionTarget(session)}
                            className="h-8 px-2.5 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/50 dark:hover:bg-rose-950/50 dark:text-rose-400 gap-1"
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Putuskan</span>
                          </Button>
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

      {/* Disconnect Modal */}
      <ConfirmDialog
        open={Boolean(disconnectSessionTarget)}
        onOpenChange={(open) => !open && setDisconnectSessionTarget(null)}
        title="Putuskan Sesi PPPoE Realtime?"
        description={`Apakah Anda yakin ingin memutuskan koneksi '${disconnectSessionTarget?.customerUsername}' dengan IP ${disconnectSessionTarget?.framedIp}? Sistem akan mengirim paket CoA Disconnect-Request.`}
        confirmLabel="Putuskan Sesi"
        variant="destructive"
        onConfirm={handleDisconnect}
      />
    </div>
  );
}
