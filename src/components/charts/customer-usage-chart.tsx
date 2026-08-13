"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CustomerDailyUsage } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

interface CustomerUsageChartProps {
  data: CustomerDailyUsage[];
}

export function CustomerUsageChart({ data }: CustomerUsageChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const down =
        payload.find((p: any) => p.dataKey === "downloadBytes")?.value || 0;
      const up =
        payload.find((p: any) => p.dataKey === "uploadBytes")?.value || 0;
      const total = down + up;

      return (
        <div className="rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {label}
          </p>
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-blue-600 dark:text-blue-400">
                Download:
              </span>
              <span className="font-medium">{formatBytes(down)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-indigo-600 dark:text-indigo-400">
                Upload:
              </span>
              <span className="font-medium">{formatBytes(up)}</span>
            </div>
            <div className="mt-1 border-t border-slate-100 pt-1 font-semibold text-slate-900 dark:border-slate-800 dark:text-slate-100">
              Total: {formatBytes(total)}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            opacity={0.4}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={4}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatBytes(value, 0)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            formatter={(value) => (
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {value === "downloadBytes" ? "Download" : "Upload"}
              </span>
            )}
          />
          <Bar
            dataKey="downloadBytes"
            name="downloadBytes"
            fill="#3b82f6"
            radius={[4, 4, 0, 0]}
            stackId="a"
          />
          <Bar
            dataKey="uploadBytes"
            name="uploadBytes"
            fill="#8b5cf6"
            radius={[4, 4, 0, 0]}
            stackId="a"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
