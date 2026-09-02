"use client";

import { parseAsInteger, useQueryState } from "nuqs";
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
import { usePortal } from "@/lib/portal-context";
import { formatBytes, formatDate, formatDuration } from "@/lib/utils";

export default function PortalSessionLogsPage() {
  const { data } = usePortal();

  // Pagination (via nuqs)
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(10).withOptions({ history: "replace" }),
  );
  const safeLimit = Math.min(Math.max(limit, 1), 50);

  const sessionLogs = data?.sessionLogs ?? [];
  const sessionTotalPages = Math.ceil(sessionLogs.length / safeLimit) || 1;
  const sessionSafePage = Math.min(Math.max(page, 1), sessionTotalPages);

  const paginatedSessionLogs = useMemo(() => {
    const start = (sessionSafePage - 1) * safeLimit;
    return sessionLogs.slice(start, start + safeLimit);
  }, [sessionLogs, sessionSafePage, safeLimit]);

  return (
    <div className="space-y-4 pt-2">
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
                  <th className="py-2.5 px-4 font-semibold">Mulai Terhubung</th>
                  <th className="py-2.5 px-4 font-semibold">
                    Selesai / Durasi
                  </th>
                  <th className="py-2.5 px-4 font-semibold">Download</th>
                  <th className="py-2.5 px-4 font-semibold">Upload</th>
                  <th className="py-2.5 px-4 font-semibold">Router (NAS)</th>
                  <th className="py-2.5 px-4 font-semibold">Sebab Berhenti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {paginatedSessionLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Belum ada riwayat sesi yang tercatat untuk pelanggan ini.
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

          {/* Pagination Footer */}
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
                    {Math.min(sessionSafePage * safeLimit, sessionLogs.length)}
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
    </div>
  );
}
