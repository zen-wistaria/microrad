/**
 * Klien WebSocket untuk halaman dashboard / sesi aktif / detail pelanggan.
 *
 * Menggantikan polling REST 5-6 detik lama: menerima snapshot live yang
 * didorong server (hanya bila server menyediakan WS di /api/v1/live —
 * dev mode tanpa WS → polling REST fallback).
 */
"use client";

import { useEffect, useRef, useState } from "react";

import type { NasRouter, Session } from "@/lib/types";

export interface LiveState {
  sessions: Session[];
  routers: NasRouter[];
  connected: boolean;
  lastUpdate?: Date;
}

export interface RealtimeLiveOptions {
  /** Aktifkan polling fallback bila WS tidak tersedia (default: false) */
  pollingFallback?: boolean;
  pollingIntervalMs?: number;
  onSnapshot?: (snap: { sessions: Session[]; routers: NasRouter[] }) => void;
}

const WS_URL = () => {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/api/v1/live`;
};

/** URL WS server secara dinamis (dipakai klien). */
export function liveWebSocketUrl(): string {
  return WS_URL();
}

const mapRouter = (r: {
  id: string;
  name: string;
  ipAddress: string;
  status: string;
  activeSessionCount: number;
}): NasRouter => ({
  id: r.id,
  name: r.name,
  ipAddress: r.ipAddress,
  type: "mikrotik",
  status: r.status as NasRouter["status"],
  activeSessionCount: r.activeSessionCount,
});

const mapSession = (s: Session): Session => s;

/** Hook: subscribe ke live perubahan sesi + status router. */
export function useRealtimeLive(options: RealtimeLiveOptions = {}): {
  sessions: Session[];
  routers: NasRouter[];
  connected: boolean;
  lastUpdate?: Date;
} {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [routers, setRouters] = useState<NasRouter[]>([]);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | undefined>(undefined);
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const setSnap = (snap: { sessions: Session[]; routers: NasRouter[] }) => {
      setSessions(snap.sessions);
      setRouters(snap.routers);
      setLastUpdate(new Date());
      optsRef.current.onSnapshot?.(snap);
    };

    const connect = () => {
      try {
        ws = new WebSocket(WS_URL());
      } catch {
        if (optsRef.current.pollingFallback) startPolling();
        return;
      }
      ws.onopen = () => setConnected(true);
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as {
            type?: string;
            sessions?: Session[];
            routers?: {
              id: string;
              name: string;
              ipAddress: string;
              status: string;
              activeSessionCount: number;
            }[];
          };
          if (data.type === "snapshot") {
            setSnap({
              sessions: (data.sessions ?? []).map(mapSession),
              routers: (data.routers ?? []).map(mapRouter),
            });
          }
        } catch {
          // pesan tak dikenal — abaikan
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (optsRef.current.pollingFallback) startPolling();
      };
      ws.onerror = () => {
        try {
          ws?.close();
        } catch {
          // ignore
        }
      };
    };

    const startPolling = () => {
      if (pollTimer) return;
      const intervalMs = optsRef.current.pollingIntervalMs ?? 5000;
      pollTimer = setInterval(async () => {
        try {
          const res = await fetch(
            "/api/v1/sessions?activeOnly=true&limit=1000",
          );
          if (!res.ok) return;
          const body = (await res.json()) as {
            data?: Session[];
            routers?: {
              id: string;
              name: string;
              ipAddress: string;
              status: string;
              activeSessionCount: number;
            }[];
          };
          if (!body.data) return;
          setSnap({
            sessions: body.data.map(mapSession),
            routers: (body.routers ?? []).map(mapRouter),
          });
        } catch {
          // jangan spam error — tunggu interval berikutnya
        }
      }, intervalMs);
    };

    connect();
    return () => {
      try {
        ws?.close();
      } catch {
        // ignore
      }
      if (pollTimer) clearInterval(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { sessions, routers, connected, lastUpdate };
}
