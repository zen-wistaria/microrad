/**
 * WebSocket server sebaris untuk mode production (custom server).
 *
 * Server HTTP yang dibuat `server.ts` mengekspos `upgrade` event; kita
 * pasang `WebSocketServer` dari `ws` di path `/api/v1/live`. Snapshot
 * live dikirim saat: koneksi baru, poller `mikrotik:sync` (lewat
 * BroadcastChannel global — instrumentation dan server berbagi proses),
 * atau mutasi sesi (disconnect).
 *
 * Karena dev mode tidak memakai file ini, halaman akan otomatis
 * memakai polling fallback (useRealtimeLive).
 */

import type { Server } from "node:http";
import { WebSocketServer } from "ws";
import { prisma } from "@/lib/prisma";
import type { LiveSnapshot } from "./hub";
import { buildLiveFrames } from "./hub";

export interface RealtimePayload {
  sessions: LiveSnapshot[];
  routers: RouterBrief[];
}

export interface RouterBrief {
  id: string;
  name: string;
  ipAddress: string;
  status: "online" | "offline" | "unknown";
  activeSessionCount: number;
}

const HEARTBEAT_MS = 30_000;

let wss: WebSocketServer | null = null;
type WsSocket = import("ws").WebSocket & { isAlive?: boolean };
let sockets = new Set<WsSocket>();

/** Query ringan status router + jumlah sesi live (dipakai tiap push). */
async function routerBriefs(): Promise<RouterBrief[]> {
  try {
    const [routers, counts] = await Promise.all([
      prisma.nasRouter.findMany({
        select: { id: true, name: true, ipAddress: true, status: true },
      }),
      prisma.session.groupBy({
        by: ["nasId"],
        where: { stoppedAt: null },
        _count: { _all: true },
      }),
    ]);
    const countMap = new Map(counts.map((c) => [c.nasId, c._count._all]));
    return routers.map((r) => ({
      id: r.id,
      name: r.name,
      ipAddress: r.ipAddress,
      status: r.status as RouterBrief["status"],
      activeSessionCount: countMap.get(r.id) ?? 0,
    }));
  } catch {
    return [];
  }
}

function broadcast(payload: RealtimePayload): void {
  const text = JSON.stringify(payload);
  for (const s of sockets) {
    if (s.readyState === s.OPEN) s.send(text);
  }
}

/** Push snapshot ke semua klien (dipanggil poller / mutasi via index). */
export function pushRealtime(live: LiveSnapshot[]): void {
  if (!wss || sockets.size === 0) return;
  void (async () => {
    const routers = await routerBriefs();
    // gunakan frame segar dari hub agar durasi/bytes selalu ter-inflasi
    const frames = buildLiveFrames(new Date());
    broadcast({
      sessions: frames.length > 0 ? frames : live,
      routers,
    });
  })();
}

export function attachWs(server: Server): void {
  if (wss) return;
  wss = new WebSocketServer({ server, path: "/api/v1/live" });
  sockets = new Set();

  const heartbeat = setInterval(() => {
    for (const s of sockets) {
      if (!s.isAlive) {
        s.terminate();
        sockets.delete(s);
        continue;
      }
      s.isAlive = false;
      s.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  wss.on("connection", (socket) => {
    (socket as WsSocket).isAlive = true;
    socket.on("pong", () => {
      (socket as WsSocket).isAlive = true;
    });
    sockets.add(socket);
    socket.send(JSON.stringify({ type: "hello" }));

    // Kirim snapshot segera agar UI segar tanpa menunggu poller
    void (async () => {
      const routers = await routerBriefs();
      const frames = buildLiveFrames(new Date());
      if (socket.readyState === socket.OPEN) {
        socket.send(
          JSON.stringify({ type: "snapshot", sessions: frames, routers }),
        );
      }
    })();
  });

  wss.on("close", () => {
    clearInterval(heartbeat);
    sockets.clear();
    wss = null;
  });
}
