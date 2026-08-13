"use client";

import React, { useEffect, useState } from "react";
import { formatDuration } from "@/lib/utils";
import { Clock } from "lucide-react";

interface LiveCounterProps {
  startedAt: string;
  className?: string;
  showIcon?: boolean;
}

export function LiveDurationCounter({ startedAt, className = "", showIcon = false }: LiveCounterProps) {
  const [seconds, setSeconds] = useState<number>(() => {
    const start = new Date(startedAt).getTime();
    return Math.max(0, Math.floor((Date.now() - start) / 1000));
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const start = new Date(startedAt).getTime();
      setSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-sm ${className}`}>
      {showIcon && <Clock className="h-3.5 w-3.5 text-slate-400" />}
      {formatDuration(seconds, "human")}
    </span>
  );
}
