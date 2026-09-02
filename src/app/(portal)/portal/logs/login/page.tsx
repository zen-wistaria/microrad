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
import { formatDate, formatRelativeTime } from "@/lib/utils";

export default function PortalLoginLogsPage() {
  const { data } = usePortal();

  // Pagination (via nuqs)
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [limit, setLimit] = useQueryState(
    "limit",
    parseAsInteger.withDefault(10).withOptions({ history: "replace" }),
  );
  const safeLimit = Math.min(Math.max(limit, 1), 50);

  const loginLogs = data?.loginLogs ?? [];
  const loginTotalPages = Math.ceil(loginLogs.length / safeLimit) || 1;
  const loginSafePage = Math.min(Math.max(page, 1), loginTotalPages);

  const paginatedLoginLogs = useMemo(() => {
    const start = (loginSafePage - 1) * safeLimit;
    return loginLogs.slice(start, start + safeLimit);
  }, [loginLogs, loginSafePage, safeLimit]);

  return (
    <div className="space-y-4 pt-2">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Log Login</CardTitle>
          <CardDescription>
            Riwayat masuk ke akun portal — mencatat IP, perangkat (user agent),
            dan waktu login.
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
                {paginatedLoginLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      Belum ada riwayat login tercatat.
                    </td>
                  </tr>
                ) : (
                  paginatedLoginLogs.map((log) => (
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
                          {log.source === "admin"
                            ? "Admin"
                            : "Portal Langganan"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
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
    </div>
  );
}
