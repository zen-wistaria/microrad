"use client";

import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";
import { LiveDurationCounter } from "@/components/common/live-counter";
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
import { useCustomerSessionsQuery } from "@/lib/api/hooks";
import { formatBytes, formatDate, formatDuration } from "@/lib/utils";
import { useCustomerDetail } from "../customer-detail-context";

export default function CustomerHistoryPage() {
  const { customerId } = useCustomerDetail();

  // Filter tahun & bulan (via nuqs)
  const [selectedYear, setSelectedYear] = useQueryState(
    "year",
    parseAsInteger.withDefault(new Date().getFullYear()),
  );
  const [selectedMonth, setSelectedMonth] = useQueryState(
    "month",
    parseAsString.withDefault("all"),
  );

  // Pagination (via nuqs)
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(10).withOptions({ history: "replace" }),
  );
  const safeLimit = Math.min(Math.max(limit, 1), 50);

  const sessFilter = useMemo(
    () => ({
      year: selectedYear,
      month: selectedMonth !== "all" ? Number(selectedMonth) : undefined,
      page,
      limit: safeLimit,
    }),
    [selectedYear, selectedMonth, page, safeLimit],
  );

  // Deret tahun (mis. 2022–2026) untuk opsi filter
  const years = useMemo(() => {
    const cur = new Date().getFullYear();
    const arr: number[] = [];
    for (let y = cur; y >= cur - 3; y--) arr.push(y);
    return arr;
  }, []);

  const { data: sessionRes, isLoading } = useCustomerSessionsQuery(
    customerId,
    sessFilter,
  );
  const sessionHistory = sessionRes?.data || [];
  const sessionTotalCount = sessionRes?.total ?? 0;

  const sessionTotalPages = Math.ceil(sessionTotalCount / safeLimit) || 1;
  const sessionSafePage = Math.min(Math.max(page, 1), sessionTotalPages);

  return (
    <div className="pt-2">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                Catatan Histori Sesi RADIUS Accounting
              </CardTitle>
              <CardDescription>
                Semua rekaman sesi PPPoE pelanggan (online & selesai) dari tabel{" "}
                <code className="text-xs">radacct</code>.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={String(selectedYear)}
                onValueChange={(v) => {
                  setSelectedYear(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-28 h-9">
                  <SelectValue placeholder="Tahun" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedMonth}
                onValueChange={(v) => {
                  setSelectedMonth(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-32 h-9">
                  <SelectValue placeholder="Bulan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {new Date(0, m - 1, 1).toLocaleDateString("id-ID", {
                        month: "long",
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 text-slate-500 border-y border-slate-200 dark:bg-slate-800/50 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Mulai Koneksi</th>
                  <th className="py-2.5 px-4 font-semibold">
                    Durasi / Selesai
                  </th>
                  <th className="py-2.5 px-4 font-semibold">Download</th>
                  <th className="py-2.5 px-4 font-semibold">Upload</th>
                  <th className="py-2.5 px-4 font-semibold">Router (NAS)</th>
                  <th className="py-2.5 px-4 font-semibold">Sebab Berhenti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Memuat data sesi...
                    </td>
                  </tr>
                ) : sessionHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Belum ada riwayat sesi yang tercatat untuk pelanggan ini.
                    </td>
                  </tr>
                ) : (
                  sessionHistory.map((sess) => (
                    <tr
                      key={sess.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {formatDate(sess.startedAt)}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400">
                          IP: {sess.framedIp || "-"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {!sess.stoppedAt ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              Online
                            </span>
                            <div>
                              <LiveDurationCounter
                                startedAt={sess.startedAt}
                                baseSeconds={
                                  sess.durationSeconds > 0
                                    ? sess.durationSeconds
                                    : undefined
                                }
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-slate-700 dark:text-slate-300">
                              {formatDuration(sess.durationSeconds)}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Putus: {formatDate(sess.stoppedAt)}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-blue-600 dark:text-blue-400">
                        {formatBytes(sess.outputBytes)}
                      </td>
                      <td className="py-3 px-4 font-medium text-indigo-600 dark:text-indigo-400">
                        {formatBytes(sess.inputBytes)}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                        {sess.nasIpAddress}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {sess.terminateCause ||
                            (sess.stoppedAt ? "Normal" : "Active")}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {sessionTotalCount > 0 && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>
                  Menampilkan{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {(sessionSafePage - 1) * safeLimit + 1}
                  </span>{" "}
                  -{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {Math.min(sessionSafePage * safeLimit, sessionTotalCount)}
                  </span>{" "}
                  dari{" "}
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {sessionTotalCount}
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
