/**
 * Poller sinkronisasi router MikroTik — HEARTBEAT STATUS SAJA.
 *
 * SUMBER KEBENARAN SESI ONLINE & TRAFIK = tabel `radacct` FreeRADIUS
 * (Start / Interim-Update tiap menit / Stop) — dibaca langsung oleh
 * API route; tabel `session` aplikasi TIDAK dipakai lagi.
 *
 * Poller ini hanya:
 *  - ping/identity API router → update `status`/`lastSeenAt`
 */
import { connectRouterOS } from "./mikrotik-client";
import { prisma } from "./prisma";

export interface SyncSummary {
  created: number;
  updated: number;
  closed: number;
  error?: string;
}

const g = globalThis as unknown as {
  __mikrotikSyncStarted?: boolean;
  __mikrotikLastTickAt?: number;
};

/** Mulai poller interval (dipanggil instrumentation). */
export function startMikrotikSync(): void {
  if (process.env.MIKROTIK_SYNC_ENABLED === "false") return;

  const intervalMs = Number(process.env.MIKROTIK_SYNC_INTERVAL_MS ?? "10000");

  const tick = async () => {
    const started = Date.now();
    try {
      // Guard ekstra: bila tick terakhir masih segar (interval nyata masih
      // hidup), jangan jalankan ganda — mencegah HMR menyebabkan balapan.
      const last = g.__mikrotikLastTickAt ?? 0;
      if (started - last < intervalMs / 2) return;
      g.__mikrotikLastTickAt = started;
      const results = await syncAllRouters();
      if (results.some((r) => r.error)) {
        console.log(
          `[mikrotik-sync] tick: ${results
            .map((r) => (r.error ? `!${r.error.slice(0, 60)}` : "ok"))
            .join(", ")} (${Date.now() - started}ms)`,
        );
      }
    } catch (e) {
      console.error("[mikrotik-sync] tick error:", e);
    }
  };

  // Tick pertama segera (status router cepat akurat), lalu interval
  void tick();
  const id = setInterval(() => void tick(), intervalMs);
  if (typeof id === "object" && "unref" in id) id.unref();
}

/** Sinkronkan SEMUA router (sekali per tick). */
export async function syncAllRouters(): Promise<SyncSummary[]> {
  const routers = await prisma.nasRouter.findMany({
    where: { apiUsername: { not: null }, syncEnabled: true },
    orderBy: { name: "asc" },
  });
  const results: SyncSummary[] = [];
  for (const r of routers) {
    results.push(await syncSingleRouter(r));
  }
  return results;
}

/** Heartbeat satu router; kembalikan ringkasan. */
export async function syncSingleRouter(router: {
  id: string;
  ipAddress: string;
  name: string;
  apiUsername?: string | null;
  apiPassword?: string | null;
  apiPort?: number;
}): Promise<SyncSummary> {
  const mark: SyncSummary = { created: 0, updated: 0, closed: 0 };
  const now = new Date();

  // Heartbeat — ping/identity API router
  let conn: Awaited<ReturnType<typeof connectRouterOS>> | null = null;
  try {
    conn = await connectRouterOS(router);
    await conn.write("/system/identity/print");
    await prisma.nasRouter.update({
      where: { id: router.id },
      data: { status: "online", lastSeenAt: now, lastSyncedAt: now },
    });
  } catch (err) {
    mark.error = err instanceof Error ? err.message : String(err);
    await prisma.nasRouter.update({
      where: { id: router.id },
      data: { status: "offline", lastSeenAt: now },
    });
    conn?.close();
    return mark;
  } finally {
    conn?.close();
  }
  return mark;
}

/**
 * Pastikan satu siklus heartbeat baru saja berjalan (throttle ~12s).
 * Dipanggil ringan dari API — hanya soal status router, bukan sesi.
 */
let lastSyncRun = 0;
const SYNC_THROTTLE_MS = 12_000;

export async function ensureSyncRuns(): Promise<void> {
  if (process.env.MIKROTIK_SYNC_ENABLED === "false") return;
  const now = Date.now();
  if (now - lastSyncRun < SYNC_THROTTLE_MS) return;
  lastSyncRun = now;
  try {
    await syncAllRouters();
  } catch (e) {
    console.error("[mikrotik-sync] ensureSyncRuns error:", e);
  }
}
