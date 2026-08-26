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
}

function computeDuration(
  startedAt: string,
  baseSeconds?: number,
  baseUpdatedAt?: string,
): number {
  const nowMs = Date.now();
  const startMs = new Date(startedAt).getTime();
  const fallback = Math.max(0, Math.floor((nowMs - startMs) / 1000));

  if (baseSeconds !== undefined && baseSeconds > 0) {
    if (baseUpdatedAt) {
      const ref = new Date(baseUpdatedAt).getTime();
      const elapsedSinceRef = Math.max(0, Math.round((nowMs - ref) / 1000));
      return Math.max(fallback, baseSeconds + elapsedSinceRef);
    }
    return Math.max(fallback, baseSeconds);
  }
  return fallback;
}

export function LiveDurationCounter({
  startedAt,
  baseSeconds,
  baseUpdatedAt,
  className = "",
  showIcon = false,
}: LiveCounterProps) {
  const [seconds, setSeconds] = useState(() =>
    computeDuration(startedAt, baseSeconds, baseUpdatedAt),
  );

  useEffect(() => {
    setSeconds(computeDuration(startedAt, baseSeconds, baseUpdatedAt));
    const interval = setInterval(
      () => setSeconds(computeDuration(startedAt, baseSeconds, baseUpdatedAt)),
      1000,
    );
    return () => clearInterval(interval);
  }, [startedAt, baseSeconds, baseUpdatedAt]);

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-sm ${className}`}
    >
      {showIcon && <Clock className="h-3.5 w-3.5 text-slate-400" />}
      {formatDuration(seconds, "human")}
    </span>
  );
}
