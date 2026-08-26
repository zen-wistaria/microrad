"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/utils";

interface LiveCounterProps {
  startedAt: string;
  /** Durasi basis (detik) dari server — bila ada, dipakai + tick sejak update */
  baseSeconds?: number;
  /** Reference waktu server untuk basis (ISO) — inflasi sejak update */
  baseUpdatedAt?: string;
  className?: string;
  showIcon?: boolean;
  format?: "short" | "human";
}

function normalizeTimestampMs(
  isoString?: string | null,
  nowMs: number = Date.now(),
): number | null {
  if (!isoString) return null;
  const date = new Date(isoString);
  let ms = date.getTime();
  if (Number.isNaN(ms)) return null;
  if (ms > nowMs + 60 * 1000) {
    const hourDiff = Math.round((ms - nowMs) / 3600000);
    if (hourDiff >= 1 && hourDiff <= 14) {
      ms -= hourDiff * 3600000;
    }
  }
  return ms;
}

function resolveInitialSeconds(
  startedAt: string,
  baseSeconds?: number,
  baseUpdatedAt?: string,
): number {
  const nowMs = Date.now();
  const startMs = normalizeTimestampMs(startedAt, nowMs);
  const updateMs = normalizeTimestampMs(baseUpdatedAt, nowMs);
  const base = baseSeconds && baseSeconds > 0 ? baseSeconds : 0;

  let computed = base;
  if (startMs && startMs <= nowMs) {
    computed = Math.max(computed, Math.floor((nowMs - startMs) / 1000));
  }
  if (updateMs && updateMs <= nowMs) {
    computed = Math.max(computed, base + Math.floor((nowMs - updateMs) / 1000));
  }

  return Math.max(0, computed);
}

export function LiveDurationCounter({
  startedAt,
  baseSeconds,
  baseUpdatedAt,
  className = "",
  showIcon = false,
  format = "human",
}: LiveCounterProps) {
  const [initialSeconds, setInitialSeconds] = useState(() =>
    resolveInitialSeconds(startedAt, baseSeconds, baseUpdatedAt),
  );
  const [mountTime, setMountTime] = useState(() => Date.now());
  const [elapsedOffset, setElapsedOffset] = useState(0);

  // Jika props (data dari server / query refetch) berubah, perbarui baseline
  useEffect(() => {
    setInitialSeconds(
      resolveInitialSeconds(startedAt, baseSeconds, baseUpdatedAt),
    );
    setMountTime(Date.now());
    setElapsedOffset(0);
  }, [startedAt, baseSeconds, baseUpdatedAt]);

  // Tick setiap 1 detik secara konsisten menggunakan selisih wall-clock Date.now()
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedOffset(Math.floor((Date.now() - mountTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [mountTime]);

  const currentSeconds = Math.max(0, initialSeconds + elapsedOffset);

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-sm ${className}`}
    >
      {showIcon && <Clock className="h-3.5 w-3.5 text-slate-400" />}
      {formatDuration(currentSeconds, format)}
    </span>
  );
}
