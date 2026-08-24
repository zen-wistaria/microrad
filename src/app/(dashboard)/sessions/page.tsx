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
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { LiveDurationCounter } from "@/components/common/live-counter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useBulkDisconnectSessionsMutation,
  useDisconnectSessionMutation,
  useRoutersQuery,
  useSessionsQuery,
} from "@/lib/api/hooks";
import type { Session } from "@/lib/types";
import { useDebounce } from "@/lib/use-debounce";
import { formatBytes, getErrorMessage } from "@/lib/utils";

export default function SessionsPage() {
  const { data: routersRes } = useRoutersQuery({ limit: 1000 });
  const routers = routersRes?.data || [];

  // Search & Filter
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 350);

  const [routerFilter, setRouterFilter] = useQueryState(
    "router",
    parseAsString.withDefault("all"),
  );

  // Pagination (via nuqs — konsisten saat refresh)
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(10).withOptions({ history: "replace" }),
  );
  const safeLimit = Math.min(Math.max(limit, 1), 50); // maksimal 50
  const safePage = Math.max(page, 1);

  // TanStack Query
  const {
    data: sessRes,
    isLoading: sessionsLoading,
    refetch,
    isFetching,
  } = useSessionsQuery({
    activeOnly: true,
    search: search.trim() || undefined,
    router: routerFilter === "all" ? undefined : routerFilter,
    page: safePage,
    limit: safeLimit,
  });

  const disconnectSessionMutation = useDisconnectSessionMutation();
  const bulkDisconnectSessionsMutation = useBulkDisconnectSessionsMutation();

  const sessions = sessRes?.data || [];
  const totalCount = sessRes?.total || 0;
  const loading = sessionsLoading && !sessRes;
  const totalPages = Math.ceil(totalCount / safeLimit) || 1;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Disconnect Target
  const [disconnectSessionTarget, setDisconnectSessionTarget] =
    useState<Session | null>(null);
  const [isBulkDisconnectOpen, setIsBulkDisconnectOpen] = useState(false);

  // Sync debounced search to URL state
  useEffect(() => {
    if (debouncedSearch !== search) {
      setSearch(debouncedSearch);
      setPage(1);
    }
  }, [debouncedSearch, search, setSearch, setPage]);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // Reset selection saat page / filter berubah
  useEffect(() => {
    if (page || limit || routerFilter || search) {
      setSelectedIds(new Set());
    }
  }, [page, limit, routerFilter, search]);

  // Selection helpers
  const allCurrentPageSelected =
    sessions.length > 0 && sessions.every((s) => selectedIds.has(s.id));
  const someCurrentPageSelected =
    sessions.some((s) => selectedIds.has(s.id)) && !allCurrentPageSelected;

  const toggleSelectAll = () => {
    if (allCurrentPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const s of sessions) next.delete(s.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const s of sessions) next.add(s.id);
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDisconnect = async () => {
    if (!disconnectSessionTarget) return;
    try {
      await disconnectSessionMutation.mutateAsync({
        sessionId: disconnectSessionTarget.id,
      });
      toast.success(
        `Sesi untuk ${disconnectSessionTarget.customerUsername} (${disconnectSessionTarget.framedIp}) berhasil diputuskan.`,
      );
      setDisconnectSessionTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal memutuskan sesi PPPoE.");
    }
  };

  const handleBulkDisconnect = async () => {
    if (selectedIds.size === 0) return;
    try {
      const res = await bulkDisconnectSessionsMutation.mutateAsync(
        Array.from(selectedIds),
      );
      toast.success(
        res.message ||
          `${selectedIds.size} sesi aktif berhasil diputuskan koneksinya.`,
      );
      setSelectedIds(new Set());
      setIsBulkDisconnectOpen(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal memutuskan sesi massal.");
    }
  };

  // Aggregate KPI Stats (keseluruhan sesi aktif dari backend)
  const totalDownloadActive =
    sessRes?.stats?.totalDownload ??
    sessions.reduce((acc, s) => acc + s.outputBytes, 0);
  const totalUploadActive =
    sessRes?.stats?.totalUpload ??
    sessions.reduce((acc, s) => acc + s.inputBytes, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Sesi PPPoE Aktif
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Monitoring koneksi pelanggan real-time, durasi online, throughput,
            dan kontrol pemutusan sesi RADIUS CoA.
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
            <span>Segarkan</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">
                Sesi Pelanggan Aktif
              </p>
              <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {totalCount} Pelanggan
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
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 text-xs sm:text-sm"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-56">
                <Select
                  value={routerFilter}
                  onValueChange={(v) => {
                    setRouterFilter(v);
                    setPage(1);
                  }}
                >
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

              {(search || searchInput || routerFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setRouterFilter("all");
                    setPage(1);
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
                  <th className="py-3 px-4 w-10 text-center">
                    <Checkbox
                      checked={allCurrentPageSelected}
                      indeterminate={someCurrentPageSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Pilih semua sesi di halaman ini"
                    />
                  </th>
                  <th className="py-3 px-4 font-semibold">Pelanggan</th>
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
                      <td colSpan={8} className="p-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12">
                      <EmptyState
                        icon={Activity}
                        title="Tidak ada sesi aktif"
                        description={
                          search || routerFilter !== "all"
                            ? "Tidak ada sesi yang sesuai dengan kriteria pencarian Anda."
                            : "Saat ini tidak ada pelanggan yang sedang terhubung online."
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => {
                    const routerObj = routers.find(
                      (r) => r.ipAddress === session.nasIpAddress,
                    );
                    const isSelected = selectedIds.has(session.id);

                    return (
                      <tr
                        key={session.id}
                        className={`transition-colors ${
                          isSelected
                            ? "bg-blue-50/60 dark:bg-blue-950/30"
                            : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                        }`}
                      >
                        <td className="py-3.5 px-4 w-10 text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(session.id)}
                            aria-label={`Pilih ${session.customerUsername}`}
                          />
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {session.customerId ? (
                            <Link
                              href={`/customers/${session.customerId}`}
                              className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline flex items-center gap-1.5"
                            >
                              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                              {session.customerUsername}
                            </Link>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                              {session.customerUsername}
                            </span>
                          )}
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
                            baseSeconds={
                              session.durationSeconds > 0
                                ? session.durationSeconds
                                : undefined
                            }
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

          {/* Pagination Footer */}
          {!loading && totalCount > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Menampilkan{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min((safePage - 1) * safeLimit + 1, totalCount)}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min(safePage * safeLimit, totalCount)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {totalCount}
                  </span>{" "}
                  sesi
                </span>
                <Select
                  value={String(safeLimit)}
                  onValueChange={(v) => {
                    setLimit(Number(v));
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-24 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="h-8 px-3 text-xs"
                >
                  Sebelumnya
                </Button>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Hal {safePage} dari {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="h-8 px-3 text-xs"
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 sm:gap-3 px-4 py-2.5 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white rounded-2xl shadow-2xl border border-slate-700/60 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
            <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
              {selectedIds.size} sesi dipilih
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsBulkDisconnectOpen(true)}
              className="h-8 gap-1.5 text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-950/50"
            >
              <PowerOff className="h-3.5 w-3.5" />
              <span>Putuskan Koneksi ({selectedIds.size})</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="h-8 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/30"
            >
              Batal
            </Button>
          </div>
        </div>
      )}

      {/* Disconnect Single Modal */}
      <ConfirmDialog
        open={Boolean(disconnectSessionTarget)}
        onOpenChange={(open) => !open && setDisconnectSessionTarget(null)}
        title="Putuskan Sesi PPPoE Realtime?"
        description={`Apakah Anda yakin ingin memutuskan koneksi '${disconnectSessionTarget?.customerUsername}' dengan IP ${disconnectSessionTarget?.framedIp}? Sistem akan mengirim paket CoA Disconnect-Request.`}
        confirmLabel="Putuskan Sesi"
        variant="destructive"
        onConfirm={handleDisconnect}
      />

      {/* Disconnect Bulk Modal */}
      <ConfirmDialog
        open={isBulkDisconnectOpen}
        onOpenChange={setIsBulkDisconnectOpen}
        title="Putuskan Sesi PPPoE Massal?"
        description={`Apakah Anda yakin ingin memutuskan ${selectedIds.size} sesi PPPoE aktif yang dipilih? Paket Disconnect-Request (CoA RFC 5176) akan dikirimkan ke router MikroTik masing-masing.`}
        confirmLabel="Putuskan Semua Sesi"
        variant="destructive"
        onConfirm={handleBulkDisconnect}
      />
    </div>
  );
}
