"use client";

import { Filter, RefreshCw, ScrollText, Search } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getGlobalLogs } from "@/lib/api/logs";
import type { GlobalLogEntry } from "@/lib/mock/global-logs";
import { formatDate, formatRelativeTime } from "@/lib/utils";

const SOURCE_LABELS: Record<GlobalLogEntry["source"], string> = {
  portal: "Portal Pelanggan",
  app: "Aplikasi (Admin)",
  api: "API",
};

export default function GlobalLogsPage() {
  const [logs, setLogs] = useState<GlobalLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter (via nuqs — konsisten saat refresh)
  const [search, setSearch] = useQueryState(
    "search",
    parseAsString.withDefault(""),
  );
  const [sourceFilter, setSourceFilter] = useQueryState(
    "source",
    parseAsString.withDefault("all"),
  );
  const [fromDate, setFromDate] = useQueryState(
    "from",
    parseAsString.withDefault(""),
  );
  const [toDate, setToDate] = useQueryState(
    "to",
    parseAsString.withDefault(""),
  );

  // Pagination
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(10).withOptions({ history: "replace" }),
  );
  const safeLimit = Math.min(Math.max(limit, 1), 50); // maksimal 50

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getGlobalLogs({
        search: search.trim() || undefined,
        source: sourceFilter,
        from: fromDate || undefined,
        to: toDate || undefined,
      });
      setLogs(result);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [search, sourceFilter, fromDate, toDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleReset = () => {
    setSearch("");
    setSourceFilter("all");
    setFromDate("");
    setToDate("");
    setPage(1);
  };

  // Pagination slice
  const totalPages = Math.ceil(logs.length / safeLimit) || 1;
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const paginatedLogs = useMemo(() => {
    const start = (safePage - 1) * safeLimit;
    return logs.slice(start, start + safeLimit);
  }, [logs, safePage, safeLimit]);

  // Ringkasan jumlah per sumber
  const counts = useMemo(() => {
    const c = { portal: 0, app: 0, api: 0 };
    for (const l of logs) c[l.source] += 1;
    return c;
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Log Global Sistem
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Riwayat login seluruh pengguna — waktu, IP, user agent, nama user,
            dan sumber.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={!search && sourceFilter === "all" && !fromDate && !toDate}
          >
            <Filter className="h-4 w-4" />
            Reset Filter
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Muat Ulang
          </Button>
        </div>
      </div>

      {/* Ringkasan jumlah */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500">Portal Pelanggan</span>
            <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {counts.portal}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500">Aplikasi (Admin)</span>
            <p className="mt-1 text-xl font-bold text-blue-600 dark:text-blue-400">
              {counts.app}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-xs text-slate-500">API</span>
            <p className="mt-1 text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {counts.api}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter: pencarian nama, sumber, rentang waktu */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            Filter Log
          </CardTitle>
          <CardDescription>
            Cari berdasarkan nama user, IP, atau user agent; filter sumber dan
            rentang waktu login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="log-search">Cari Nama / IP / User Agent</Label>
              <Input
                id="log-search"
                placeholder="mis. Budi, admin, 36.84..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sumber</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Semua Sumber" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Sumber</SelectItem>
                  <SelectItem value="portal">Portal Pelanggan</SelectItem>
                  <SelectItem value="app">Aplikasi (Admin)</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="log-from">Dari Tanggal</Label>
              <Input
                id="log-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="log-to">Sampai Tanggal</Label>
              <Input
                id="log-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabel log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-slate-400" />
            Riwayat Login
            {logs.length > 0 && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {logs.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Tidak ada log yang cocok dengan filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50/80 text-slate-500 border-y border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Waktu</th>
                    <th className="py-2.5 px-4 font-semibold">
                      Nama User Login
                    </th>
                    <th className="py-2.5 px-4 font-semibold">Alamat IP</th>
                    <th className="py-2.5 px-4 font-semibold">User Agent</th>
                    <th className="py-2.5 px-4 font-semibold">Sumber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {paginatedLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {formatDate(log.timestamp)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatRelativeTime(log.timestamp)}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {log.userName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {log.ipAddress}
                        </span>
                      </td>
                      <td className="max-w-[280px] py-3 px-4">
                        <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                          {log.userAgent}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={[
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            log.source === "portal"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                              : log.source === "app"
                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                                : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400",
                          ].join(" ")}
                        >
                          {SOURCE_LABELS[log.source]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!loading && logs.length > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Menampilkan{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min((safePage - 1) * safeLimit + 1, logs.length)}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min(safePage * safeLimit, logs.length)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {logs.length}
                  </span>{" "}
                  log
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
    </div>
  );
}
