"use client";

import { LogIn, RefreshCw, Satellite } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  const { customer, loginLogs, sessionLogs } = data;

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

      <Tabs defaultValue="login">
        <TabsList>
          <TabsTrigger value="login" className="gap-1.5">
            <LogIn className="h-4 w-4" />
            Log Login Sistem
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-1.5">
            <Satellite className="h-4 w-4" />
            Log Sesi PPPoE
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Log login ke sistem */}
        <TabsContent value="login" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Log Login Sistem</CardTitle>
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
                    {loginLogs.map((log) => (
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
                <table className="w-full text-left text-xs sm:text-sm">
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
                      sessionLogs.map((log) => (
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
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
