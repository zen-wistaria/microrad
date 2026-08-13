"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { UsageTrendPoint } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

interface UsageTrendChartProps {
  data: UsageTrendPoint[];
}

export function UsageTrendChart({ data }: UsageTrendChartProps) {
  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const down = payload.find((p: any) => p.dataKey === "downloadBytes")?.value || 0;
      const up = payload.find((p: any) => p.dataKey === "uploadBytes")?.value || 0;
      const total = down + up;

      return (
        <div className="rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95">
          <p className="font-semibold text-slate-900 dark:text-slate-100">{label}</p>
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Download:
              </span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{formatBytes(down)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                Upload:
              </span>
              <span className="font-medium text-slate-900 dark:text-slate-100">{formatBytes(up)}</span>
            </div>
            <div className="mt-1 border-t border-slate-100 pt-1 text-slate-500 dark:border-slate-800">
              Total Trafik: <span className="font-semibold text-slate-900 dark:text-slate-100">{formatBytes(total)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="downloadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.4} vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={12}
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
                {value === "downloadBytes" ? "Download Traffic" : "Upload Traffic"}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="downloadBytes"
            name="downloadBytes"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#downloadGradient)"
          />
          <Area
            type="monotone"
            dataKey="uploadBytes"
            name="uploadBytes"
            stroke="#8b5cf6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#uploadGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
