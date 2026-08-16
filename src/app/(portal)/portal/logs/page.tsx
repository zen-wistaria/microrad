"use client";

import { LogIn, RefreshCw, Satellite } from "lucide-react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortal } from "@/lib/portal-context";
import {
  formatBytes,
  formatDate,
  formatDuration,
  formatRelativeTime,
} from "@/lib/utils";

export default function PortalLogsPage() {
  const { data, loading, refreshing, reload } = usePortal();

  // State tabs + pagination (via nuqs — konsisten saat refresh)
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsString.withDefault("login"),
  );
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(10).withOptions({ history: "replace" }),
  );
  const safeLimit = Math.min(Math.max(limit, 1), 50); // maksimal 50

  const loginLogs = data?.loginLogs ?? [];
  const sessionLogs = data?.sessionLogs ?? [];

  // Pagination per tab (satu halaman terpisah per tab)
  const loginTotalPages = Math.ceil(loginLogs.length / safeLimit) || 1;
  const loginSafePage = Math.min(Math.max(page, 1), loginTotalPages);
  const paginatedLoginLogs = useMemo(() => {
    const start = (loginSafePage - 1) * safeLimit;
    return loginLogs.slice(start, start + safeLimit);
  }, [loginLogs, loginSafePage, safeLimit]);

  const sessionTotalPages = Math.ceil(sessionLogs.length / safeLimit) || 1;
  const sessionSafePage = Math.min(Math.max(page, 1), sessionTotalPages);
  const paginatedSessionLogs = useMemo(() => {
    const start = (sessionSafePage - 1) * safeLimit;
    return sessionLogs.slice(start, start + safeLimit);
  }, [sessionLogs, sessionSafePage, safeLimit]);

  if (loading) {
    return <Skeleton className="h-80 w-full rounded-xl" />;
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        Data pelanggan tidak ditemukan untuk akun ini.
      </div>
    );
  }

  const { customer } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Log Aktivitas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Riwayat login ke portal dan sesi koneksi PPPoE untuk{" "}
            {customer.fullName || customer.username}.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={reload}
          disabled={refreshing}
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Muat Ulang
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="login" className="gap-1.5">
            <LogIn className="h-4 w-4" />
            Login
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-1.5">
            <Satellite className="h-4 w-4" />
            Sesi PPPoE
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Log login ke sistem */}
        <TabsContent value="login" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Log Login</CardTitle>
              <CardDescription>
                Riwayat masuk ke akun portal — mencatat IP, perangkat (user
                agent), dan waktu login.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-[11px] uppercase tracking-wider text-slate-400">
                      <th className="pb-2 pr-4 font-medium">Waktu</th>
                      <th className="pb-2 pr-4 font-medium">Alamat IP</th>
                      <th className="pb-2 pr-4 font-medium">User Agent</th>
                      <th className="pb-2 font-medium">Sumber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLoginLogs.map((log) => (
                      <tr
                        key={log.id}
                        className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                      >
                        <td className="py-2.5 pr-4">
                          <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                            {formatDate(log.loginAt)}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {formatRelativeTime(log.loginAt)}
                          </p>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {log.ipAddress}
                          </span>
                        </td>
                        <td className="max-w-[260px] py-2.5 pr-4">
                          <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                            {log.userAgent}
                          </p>
                        </td>
                        <td className="py-2.5">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {log.source === "admin" ? "Admin" : "Portal"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer — Log Login */}
              {loginLogs.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>
                      Menampilkan{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {Math.min(
                          (loginSafePage - 1) * safeLimit + 1,
                          loginLogs.length,
                        )}
                      </span>{" "}
                      -{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {Math.min(loginSafePage * safeLimit, loginLogs.length)}
                      </span>{" "}
                      dari{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {loginLogs.length}
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
                      disabled={loginSafePage === 1}
                      className="h-8 px-3 text-xs"
                    >
                      Sebelumnya
                    </Button>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Hal {loginSafePage} dari {loginTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(loginTotalPages, p + 1))
                      }
                      disabled={loginSafePage === loginTotalPages}
                      className="h-8 px-3 text-xs"
                    >
                      Selanjutnya
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Log sesi PPPoE */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Log Sesi PPPoE</CardTitle>
              <CardDescription>
                Riwayat koneksi PPPoE — kapan online, kapan offline, dan alasan
                pemutusan.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 border-y border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">
                        Mulai Terhubung
                      </th>
                      <th className="py-2.5 px-4 font-semibold">
                        Selesai / Durasi
                      </th>
                      <th className="py-2.5 px-4 font-semibold">Download</th>
                      <th className="py-2.5 px-4 font-semibold">Upload</th>
                      <th className="py-2.5 px-4 font-semibold">
                        Router (NAS)
                      </th>
                      <th className="py-2.5 px-4 font-semibold">
                        Sebab Berhenti
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {sessionLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-8 text-center text-slate-400"
                        >
                          Belum ada riwayat sesi yang tercatat untuk pelanggan
                          ini.
                        </td>
                      </tr>
                    ) : (
                      paginatedSessionLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                        >
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {formatDate(log.startedAt)}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">
                              IP: {log.framedIp || "-"}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {!log.stoppedAt ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                                Sedang Aktif
                              </span>
                            ) : (
                              <div>
                                <div className="font-medium text-slate-700 dark:text-slate-300">
                                  {formatDuration(log.durationSeconds)}
                                </div>
                                <div className="text-[11px] text-slate-400">
                                  Putus: {formatDate(log.stoppedAt)}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium text-blue-600 dark:text-blue-400">
                            {formatBytes(log.outputBytes)}
                          </td>
                          <td className="py-3 px-4 font-medium text-indigo-600 dark:text-indigo-400">
                            {formatBytes(log.inputBytes)}
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                            {log.nasIpAddress}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {log.terminateCause ||
                                (log.stoppedAt ? "Normal" : "Active")}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer — Log Sesi PPPoE */}
              {sessionLogs.length > 0 && (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>
                      Menampilkan{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {Math.min(
                          (sessionSafePage - 1) * safeLimit + 1,
                          sessionLogs.length,
                        )}
                      </span>{" "}
                      -{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {Math.min(
                          sessionSafePage * safeLimit,
                          sessionLogs.length,
                        )}
                      </span>{" "}
                      dari{" "}
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {sessionLogs.length}
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
                      disabled={sessionSafePage === 1}
                      className="h-8 px-3 text-xs"
                    >
                      Sebelumnya
                    </Button>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      Hal {sessionSafePage} dari {sessionTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(sessionTotalPages, p + 1))
                      }
                      disabled={sessionSafePage === sessionTotalPages}
                      className="h-8 px-3 text-xs"
                    >
                      Selanjutnya
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
