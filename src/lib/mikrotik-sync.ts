/**
 * Poller sinkronisasi router MikroTik — HEARTBEAT STATUS ONLINE / OFFLINE.
 *
 * Status aktif (online / offline) ditentukan murni dari PING (ICMP/TCP reachability),
 * tanpa membutuhkan kredensial API. Kredensial API hanya digunakan saat mengambil data
 * sesi PPPoE atau eksekusi perintah RouterOS.
 *
 * Interval default: 30 detik (MIKROTIK_SYNC_INTERVAL_MS = 30000).
 */
import { pingRouterHost } from "./ping";
import { prisma } from "./prisma";

export interface SyncSummary {
  id: string;
  name: string;
  ipAddress: string;
  status: "online" | "offline";
  latencyMs: number;
  error?: string;
}

const g = globalThis as unknown as {
  __mikrotikSyncStarted?: boolean;
  __mikrotikSyncTimerId?: ReturnType<typeof setInterval>;
  __mikrotikLastTickAt?: number;
};

/** Mulai poller interval (dipanggil dari instrumentation.ts). */
export function startMikrotikSync(): void {
  if (process.env.MIKROTIK_SYNC_ENABLED === "false") {
    console.log(
      "[mikrotik-sync] poller dinonaktifkan (MIKROTIK_SYNC_ENABLED=false)",
    );
    return;
  }

  const intervalMs = Number(process.env.MIKROTIK_SYNC_INTERVAL_MS ?? "30000");

  // Bersihkan interval sebelumnya jika ada (mis. saat restart / HMR)
  if (g.__mikrotikSyncTimerId) {
    clearInterval(g.__mikrotikSyncTimerId);
    g.__mikrotikSyncTimerId = undefined;
  }

  const tick = async () => {
    const started = Date.now();
    try {
      g.__mikrotikLastTickAt = started;
      const results = await syncAllRouters();
      const summaryStr = results
        .map(
          (r) =>
            `${r.name} (${r.status}${r.status === "online" ? `, ${r.latencyMs}ms` : ""})`,
        )
        .join(", ");
      const timeStr = new Date().toLocaleTimeString("id-ID");
      console.log(
        `[mikrotik-sync] [${timeStr}] poller tick: ${results.length} router checked [${summaryStr || "tidak ada router"}] (${Date.now() - started}ms)`,
      );
    } catch (e) {
      console.error("[mikrotik-sync] tick error:", e);
    }
  };

  // Jalankan tick pertama segera agar status router akurat saat startup
  void tick();

  // Jadwalkan recurring interval setiap 30 detik
  const timerId = setInterval(() => void tick(), intervalMs);
  if (typeof timerId === "object" && "unref" in timerId) {
    timerId.unref();
  }
  g.__mikrotikSyncTimerId = timerId;
  g.__mikrotikSyncStarted = true;
  console.log(
    `[mikrotik-sync] poller berjalan dengan interval ${intervalMs / 1000} detik`,
  );
}

/** Sinkronkan SEMUA router yang syncEnabled = true. */
export async function syncAllRouters(): Promise<SyncSummary[]> {
  const routers = await prisma.nasRouter.findMany({
    where: { syncEnabled: true },
    orderBy: { name: "asc" },
  });

  const results: SyncSummary[] = [];
  for (const r of routers) {
    results.push(await syncSingleRouter(r));
  }
  return results;
}

/** Heartbeat satu router (mengecek status via ping). */
export async function syncSingleRouter(router: {
  id: string;
  ipAddress: string;
  name: string;
  apiUsername?: string | null;
  apiPassword?: string | null;
  apiPort?: number;
}): Promise<SyncSummary> {
  const now = new Date();
  const ping = await pingRouterHost(router.ipAddress, router.apiPort || 8728);

  if (ping.alive) {
    // Router aktif / online via ping
    await prisma.nasRouter.update({
      where: { id: router.id },
      data: { status: "online", lastSeenAt: now, lastSyncedAt: now },
    });

    return {
      id: router.id,
      name: router.name,
      ipAddress: router.ipAddress,
      status: "online",
      latencyMs: ping.latencyMs,
    };
  } else {
    // Router tidak merespons ping -> offline
    await prisma.nasRouter.update({
      where: { id: router.id },
      data: { status: "offline", lastSeenAt: now },
    });

    return {
      id: router.id,
      name: router.name,
      ipAddress: router.ipAddress,
      status: "offline",
      latencyMs: ping.latencyMs,
      error: ping.error || "Host tidak terjangkau (ping timeout)",
    };
  }
}

/**
 * Pastikan siklus heartbeat berjalan jika belum sempat dieksekusi (throttle ~10s).
 * Dipanggil secara pasif dari endpoint router / dashboard.
 */
let lastSyncRun = 0;
const SYNC_THROTTLE_MS = 10_000;

export async function ensureSyncRuns(): Promise<void> {
  if (process.env.MIKROTIK_SYNC_ENABLED === "false") return;

  // Jika background timer belum pernah jalan, jalankan sekarang
  if (!g.__mikrotikSyncStarted) {
    startMikrotikSync();
    return;
  }

  const now = Date.now();
  if (now - lastSyncRun < SYNC_THROTTLE_MS) return;
  lastSyncRun = now;
  try {
    await syncAllRouters();
  } catch (e) {
    console.error("[mikrotik-sync] ensureSyncRuns error:", e);
  }
}
