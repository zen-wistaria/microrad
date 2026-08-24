"use client";

import {
  Activity,
  AlertCircle,
  Cable,
  CheckCircle2,
  Edit,
  KeyRound,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Router as RouterIcon,
  Search,
  Signal,
  Trash2,
  Unplug,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { RouterStatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  useConnectRadiusMutation,
  useDeleteRouterMutation,
  useDisconnectRadiusMutation,
  usePingRouterMutation,
  useRoutersQuery,
} from "@/lib/api/hooks";
import type { NasRouter } from "@/lib/types";
import { useDebounce } from "@/lib/use-debounce";
import { formatDate, getErrorMessage } from "@/lib/utils";

type BusyId = `${string}:${string}`;

export default function RoutersPage() {
  // Search & Filters (via nuqs)
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 350);

  const [statusFilter, setStatusFilter] = useQueryState(
    "status",
    parseAsString.withDefault("all"),
  );

  // Pagination (via nuqs — default limit 6)
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(6).withOptions({ history: "replace" }),
  );
  const safeLimit = Math.min(Math.max(limit, 1), 50); // maksimal 50
  const safePage = Math.max(page, 1);

  const routerParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      page: safePage,
      limit: safeLimit,
    }),
    [search, statusFilter, safePage, safeLimit],
  );

  const {
    data: routersRes,
    isLoading: routersLoading,
    refetch: refreshAll,
    isFetching,
  } = useRoutersQuery(routerParams);

  const routers = routersRes?.data || [];
  const totalRoutersCount = routersRes?.total || 0;

  const deleteRouterMutation = useDeleteRouterMutation();
  const pingRouterMutation = usePingRouterMutation();
  const connectRadiusMutation = useConnectRadiusMutation();
  const disconnectRadiusMutation = useDisconnectRadiusMutation();

  const [busy, setBusy] = useState<BusyId | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NasRouter | null>(null);

  const loading = routersLoading && !routersRes;
  const totalPages = Math.ceil(totalRoutersCount / safeLimit) || 1;
  const safePageNumber = Math.min(safePage, totalPages);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRouterMutation.mutateAsync(deleteTarget.id);
      toast.success(`Router NAS ${deleteTarget.name} berhasil dihapus.`);
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menghapus router NAS.");
    }
  };

  // Test Ping & API Connection — koneksi nyata ke host & RouterOS API
  const handleTestPing = async (router: NasRouter) => {
    setBusy(`${router.id}:ping`);
    try {
      const res = await pingRouterMutation.mutateAsync(router.id);
      if (res.status === "online") {
        toast.success(
          `Router ${router.name} (${router.ipAddress}) Online: Ping ICMP (${res.latencyMs}ms) dan API RouterOS terhubung (${res.identity || router.name}).`,
        );
      } else if (res.status === "online_ping_only") {
        toast.warning(
          `Router ${router.name} Online via Ping (${res.latencyMs}ms), tetapi API RouterOS gagal terhubung (${res.apiError || "periksa kredensial/port"}).`,
        );
      } else if (res.status === "online_api_only") {
        toast.info(
          `Router ${router.name} API RouterOS terhubung (${res.identity || router.name}), namun ping ICMP tidak merespons (kemungkinan diblokir firewall).`,
        );
      } else {
        toast.error(
          `Router ${router.name} (${router.ipAddress}) Offline: Host ping dan API tidak terjangkau (${res.latencyMs}ms timeout).`,
        );
      }
      await refreshAll();
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(err) || "Gagal melakukan test ping & API ke router.",
      );
    } finally {
      setBusy(null);
    }
  };

  // Hubungkan router ke FreeRADIUS: /radius add + /ppp aaa (via API RouterOS)
  const handleConnectRadius = async (router: NasRouter) => {
    setBusy(`${router.id}:connect`);
    try {
      await connectRadiusMutation.mutateAsync(router.id);
      toast.success(
        `Router ${router.name} dihubungkan ke FreeRADIUS (/radius add, use-radius=yes, accounting=yes, interim-update=1m).`,
      );
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(err) ||
          `Gagal menghubungkan ${router.name}. Pastikan API Username/Password dan RADIUS Secret terisi.`,
      );
    } finally {
      setBusy(null);
    }
  };

  // Putuskan router dari FreeRADIUS
  const handleDisconnectRadius = async (router: NasRouter) => {
    setBusy(`${router.id}:disconnect`);
    try {
      await disconnectRadiusMutation.mutateAsync(router.id);
      toast.success(
        `Router ${router.name} (${router.ipAddress}) berhasil diputus dari FreeRADIUS.`,
      );
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(err) || "Gagal memutuskan router dari FreeRADIUS.",
      );
    } finally {
      setBusy(null);
    }
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
            onClick={() => refreshAll()}
            disabled={isFetching}
            className="gap-1.5 text-xs text-slate-600 dark:text-slate-400"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`}
            />
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

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari nama router, IP address, atau lokasi..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 text-xs sm:text-sm"
              />
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-52">
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Status Router" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="online">Online (Ping + API)</SelectItem>
                    <SelectItem value="online_ping_only">
                      Online (Hanya Ping)
                    </SelectItem>
                    <SelectItem value="online_api_only">
                      Online (Hanya API)
                    </SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(search || searchInput || statusFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setStatusFilter("all");
                    setPage(1);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Routers Grid */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: safeLimit }).map((_, i) => (
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
            const sessionCount = router.activeSessionCount ?? 0;
            const isPinging = busy === `${router.id}:ping`;
            const isConnecting = busy === `${router.id}:connect`;
            const isDisconnecting = busy === `${router.id}:disconnect`;
            const isBusy = Boolean(busy?.startsWith(`${router.id}:`));
            // Kredensial lengkap: username terisi + password tersimpan di DB
            // (boleh kosong — password kosong adalah default RouterOS yang sah)
            const credSet =
              Boolean(router.apiUsername) && router.apiPasswordSet !== false;

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

                  <CardContent className="space-y-3">
                    {/* Location and Details */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                      {router.location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{router.location}</span>
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                          credSet
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                            : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                        }`}
                      >
                        <KeyRound className="h-3 w-3" />
                        API: {credSet ? "terisi" : "belum diisi"}
                      </span>
                      {router.radiusEnabled && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-400">
                          <Cable className="h-3 w-3" />
                          FreeRADIUS
                        </span>
                      )}
                      {router.lastSyncedAt && (
                        <span className="text-slate-400">
                          Sync {formatDate(router.lastSyncedAt)}
                        </span>
                      )}
                    </div>

                    {/* Status Alert Banner when status is Green (online - Ping & API OK) */}
                    {router.status === "online" && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                              Koneksi Normal (Ping & API Terhubung)
                            </p>
                            <p className="mt-0.5 text-emerald-700 dark:text-emerald-300/90 leading-relaxed">
                              Ping ICMP dan API RouterOS berhasil terhubung.
                              Pemantauan sesi, status heartbeat, dan
                              sinkronisasi RADIUS berjalan optimal.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Problem Alert Banner when status is Yellow (online_ping_only) */}
                    {router.status === "online_ping_only" && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-amber-900 dark:text-amber-200">
                              Kendala API RouterOS
                            </p>
                            <p className="mt-0.5 text-amber-700 dark:text-amber-300/90 leading-relaxed">
                              Ping ICMP berhasil terhubung, namun koneksi API
                              RouterOS gagal. Periksa service{" "}
                              <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">
                                /ip service api
                              </code>{" "}
                              (port {router.apiPort || 8728}), API username,
                              atau password.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Problem Alert Banner when status is Blue (online_api_only) */}
                    {router.status === "online_api_only" && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-2.5 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
                        <div className="flex items-start gap-2">
                          <Activity className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-blue-900 dark:text-blue-200">
                              Kendala Ping ICMP
                            </p>
                            <p className="mt-0.5 text-blue-700 dark:text-blue-300/90 leading-relaxed">
                              API RouterOS berhasil terhubung, namun ping ICMP
                              tidak merespons. Periksa aturan firewall MikroTik
                              (drop ping ICMP pada filter rules).
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Problem Alert Banner when status is Red (offline) */}
                    {router.status === "offline" && (
                      <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-2.5 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                        <div className="flex items-start gap-2">
                          <WifiOff className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-semibold text-rose-900 dark:text-rose-200">
                              Router Tidak Terjangkau
                            </p>
                            <p className="mt-0.5 text-rose-700 dark:text-rose-300/90 leading-relaxed">
                              Host router dan API RouterOS tidak merespons ping
                              / timeout. Periksa konektivitas jaringan atau IP
                              address router.
                            </p>
                          </div>
                        </div>
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

                <div className="flex flex-col gap-2 border-t border-slate-100 p-4 pt-3 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestPing(router)}
                      disabled={isBusy}
                      className="h-8 px-2.5 text-xs text-slate-600 dark:text-slate-400 gap-1.5"
                    >
                      {isPinging ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                      ) : (
                        <Signal className="h-3.5 w-3.5" />
                      )}
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

                  <div className="w-full">
                    {router.radiusEnabled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnectRadius(router)}
                        disabled={isBusy}
                        className="w-full h-8 text-xs text-rose-600 dark:text-rose-400 gap-1.5"
                      >
                        {isDisconnecting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Unplug className="h-3.5 w-3.5" />
                        )}
                        {isDisconnecting ? "Memutus..." : "Putus FreeRADIUS"}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={isBusy || !credSet}
                        onClick={() => handleConnectRadius(router)}
                        className="w-full h-8 text-xs gap-1.5"
                      >
                        {isConnecting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Cable className="h-3.5 w-3.5" />
                        )}
                        {isConnecting
                          ? "Menghubungkan..."
                          : "Hubungkan FreeRADIUS"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination Footer */}
      {!loading && totalRoutersCount > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-slate-200 px-4 py-3 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              Menampilkan{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {(safePageNumber - 1) * safeLimit + 1}
              </span>{" "}
              -{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {Math.min(safePageNumber * safeLimit, totalRoutersCount)}
              </span>{" "}
              dari{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {totalRoutersCount}
              </span>{" "}
              router
            </span>
            <Select
              value={String(safeLimit)}
              onValueChange={(v) => {
                setLimit(Number(v));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="15">15</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePageNumber === 1}
              className="h-8 px-3 text-xs"
            >
              Sebelumnya
            </Button>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Hal {safePageNumber} dari {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePageNumber === totalPages}
              className="h-8 px-3 text-xs"
            >
              Selanjutnya
            </Button>
          </div>
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
