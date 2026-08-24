/**
 * Poller sinkronisasi router MikroTik — HEARTBEAT STATUS ONLINE / OFFLINE.
 *
 * Status aktif (online / offline) ditentukan murni dari PING (ICMP/TCP reachability),
 * tanpa membutuhkan kredensial API. Kredensial API hanya digunakan saat mengambil data
 * sesi PPPoE atau eksekusi perintah RouterOS.
 *
 * Interval default: 30 detik (MIKROTIK_SYNC_INTERVAL_MS = 30000).
 */
import { connectRouterOS } from "./mikrotik-client";
import { pingIcmp } from "./ping";
import { prisma } from "./prisma";
import type { NasRouterStatus } from "./types";

export interface SyncSummary {
  id: string;
  name: string;
  ipAddress: string;
  status: NasRouterStatus;
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

      // Bersihkan sesi zombie radacct (> 3 menit tanpa update) & IP pool kadaluarsa
      const { cleanupZombieSessions } = await import("./radacct-cleanup");
      await cleanupZombieSessions(3);

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

/** Sinkronkan SEMUA router yang syncEnabled = true secara paralel. */
export async function syncAllRouters(): Promise<SyncSummary[]> {
  const routers = await prisma.nasRouter.findMany({
    where: { syncEnabled: true },
    orderBy: { name: "asc" },
  });

  if (routers.length === 0) return [];
  // Eksekusi ping seluruh router secara paralel (bukan sekuensial) agar instan
  return Promise.all(routers.map((r) => syncSingleRouter(r)));
}

/** Heartbeat satu router (mengecek status via ping ICMP & API RouterOS). */
export async function syncSingleRouter(router: {
  id: string;
  ipAddress: string;
  name: string;
  apiUsername?: string | null;
  apiPassword?: string | null;
  apiPort?: number;
}): Promise<SyncSummary> {
  const now = new Date();

  // 1. Tes Ping ICMP
  const icmp = await pingIcmp(router.ipAddress, 1500);
  const pingOk = icmp.alive;

  // 2. Tes API RouterOS jika kredensial ada
  let apiOk = false;
  let apiError: string | undefined;

  if (router.apiUsername) {
    try {
      const mikrotik = await connectRouterOS(
        {
          ipAddress: router.ipAddress,
          apiUsername: router.apiUsername,
          apiPassword: router.apiPassword ?? "",
          apiPort: router.apiPort || 8728,
        },
        2000,
      );
      try {
        await mikrotik.write("/system/identity/print");
        apiOk = true;
      } finally {
        mikrotik.close();
      }
    } catch (err) {
      apiOk = false;
      apiError = err instanceof Error ? err.message : String(err);
    }
  } else {
    apiOk = false;
    apiError = "Kredensial API belum dikonfigurasi";
  }

  // 3. Tentukan Status
  let status: NasRouterStatus;
  if (pingOk && apiOk) {
    status = "online";
  } else if (pingOk && !apiOk) {
    status = "online_ping_only";
  } else if (!pingOk && apiOk) {
    status = "online_api_only";
  } else {
    status = "offline";
  }

  await prisma.nasRouter.update({
    where: { id: router.id },
    data: {
      status,
      lastSeenAt: now,
      lastSyncedAt: status !== "offline" ? now : undefined,
    },
  });

  return {
    id: router.id,
    name: router.name,
    ipAddress: router.ipAddress,
    status,
    latencyMs: icmp.latencyMs,
    error: status === "offline" ? "Host dan API tidak terjangkau" : apiError,
  };
}

/**
 * Pastikan siklus heartbeat berjalan jika belum sempat dieksekusi (throttle ~10s).
 * Dijalankan di background (non-blocking) agar TIDAK memperlambat respon HTTP API.
 */
let lastSyncRun = 0;
const SYNC_THROTTLE_MS = 10_000;

export function ensureSyncRuns(): void {
  if (process.env.MIKROTIK_SYNC_ENABLED === "false") return;

  // Jika background timer belum pernah jalan, jalankan sekarang
  if (!g.__mikrotikSyncStarted) {
    startMikrotikSync();
    return;
  }

  const now = Date.now();
  if (now - lastSyncRun < SYNC_THROTTLE_MS) return;
  lastSyncRun = now;

  // Fire-and-forget di background tanpa menahan HTTP response
  syncAllRouters().catch((e) => {
    console.error("[mikrotik-sync] ensureSyncRuns error:", e);
  });
}
