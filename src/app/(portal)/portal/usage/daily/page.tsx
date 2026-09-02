"use client";

import { CustomerUsageChart } from "@/components/charts/customer-usage-chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePortal } from "@/lib/portal-context";
import { formatBytes } from "@/lib/utils";

export default function PortalDailyUsagePage() {
  const { data } = usePortal();
  const daily = data?.usageHistory ?? [];

  return (
    <div className="space-y-6 pt-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Grafik Pemakaian 30 Hari Terakhir
          </CardTitle>
          <CardDescription>
            Grafik harian download vs upload. Data per hari selama sebulan
            terakhir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {daily.length > 0 ? (
            <CustomerUsageChart data={daily} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-400">
              Belum ada data pemakaian.
            </p>
          )}
        </CardContent>
      </Card>

      {daily.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Rincian Harian (30 Hari Terakhir)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="pb-2 pr-4 font-medium">Tanggal</th>
                    <th className="pb-2 pr-4 font-medium">Download</th>
                    <th className="pb-2 pr-4 font-medium">Upload</th>
                    <th className="pb-2 pr-4 font-medium">Total</th>
                    <th className="pb-2 font-medium">Sesi</th>
                  </tr>
                </thead>
                <tbody>
                  {[...daily].reverse().map((d) => (
                    <tr
                      key={d.date}
                      className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                    >
                      <td className="py-2 pr-4 text-xs font-medium text-slate-900 dark:text-slate-100">
                        {d.date}
                      </td>
                      <td className="py-2 pr-4 text-xs text-blue-600 dark:text-blue-400">
                        {formatBytes(d.downloadBytes)}
                      </td>
                      <td className="py-2 pr-4 text-xs text-indigo-600 dark:text-indigo-400">
                        {formatBytes(d.uploadBytes)}
                      </td>
                      <td className="py-2 pr-4 text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {formatBytes(d.totalBytes)}
                      </td>
                      <td className="py-2 text-xs text-slate-600 dark:text-slate-300">
                        {d.sessionsCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
