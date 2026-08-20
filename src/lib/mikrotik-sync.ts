/**
 * Poller sinkronisasi router MikroTik + sumber sesi RADIUS.
 *
 * SUMBER KEBENARAN SESI ONLINE & TRAFIK = tabel `radacct` FreeRADIUS
 * (Start / Interim-Update tiap menit / Stop). `/ppp/active` MikroTik
 * TIDAK membawa bytes — hanya dipakai sebagai heartbeat status router.
 *
 * Algoritma per tick per router:
 *  - ping/identity API router → update `status`/`lastSeenAt`
 *  - baca sesi online dari radacct utk router tsb → sinkronkan tabel
 *    Session aplikasi (CREATE/UPDATE/CLOSE) + customer.currentSessionId
 *  - rebuild portal session log + perbarui hub realtime & broadcast
 */
import { connectRouterOS } from "./mikrotik-client";
import { syncPortalSessionLogs } from "./portal-logs";
import { prisma } from "./prisma";
import { publishMikrotikSync } from "./realtime/channel";
import type { LiveSnapshot } from "./realtime/hub";
import { setLiveSnapshots } from "./realtime/hub";

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
      console.log(
        `[mikrotik-sync] tick: ${results.map((r) => `+${r.created}/~${r.updated}/-${r.closed}${r.error ? `!${r.error.slice(0, 40)}` : ""}`).join(", ") || "(no routers)"} (${Date.now() - started}ms)`,
      );
    } catch (e) {
      console.error("[mikrotik-sync] tick error:", e);
    }
  };

  // Tick pertama segera (status router cepat akurat), lalu interval
  void tick();
  const id = setInterval(() => void tick(), intervalMs);
  if (typeof id === "object" && "unref" in id) id.unref();
}

/**
 * Pastikan satu siklus sinkronisasi baru saja berjalan (throttle ~12s).
 * Dipanggil dari API route (sessions/dashboard/customer) agar data selalu
 * segar TANPA bergantung pada poller interval yang tidak hidup di dev
 * Turbopack. Aman dipanggil berkali-kali — gabungan guard global.
 */
let lastSyncRun = 0;
const SYNC_THROTTLE_MS = 12_000;

export async function ensureSyncRuns(): Promise<void> {
  if (process.env.MIKROTIK_SYNC_ENABLED === "false") return;
  const now = Date.now();
  if (now - lastSyncRun < SYNC_THROTTLE_MS) return;
  lastSyncRun = now;
  try {
    const results = await syncAllRouters();
    console.log(
      `[mikrotik-sync] ensure: ${
        results
          .map((r) => `+${r.created}/~${r.updated}/-${r.closed}`)
          .join(", ") || "(no routers)"
      }`,
    );
  } catch (e) {
    console.error("[mikrotik-sync] ensureSyncRuns error:", e);
  }
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

/** Sinkronkan satu router; kembalikan ringkasan. */
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

  // 1) Heartbeat — ping API router (status online/offline)
  let conn: Awaited<ReturnType<typeof connectRouterOS>> | null = null;
  try {
    conn = await connectRouterOS(router);
    await conn.write("/system/identity/print");
    await prisma.nasRouter.update({
      where: { id: router.id },
      data: { status: "online", lastSeenAt: now },
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

  // 2) Sesi online dari radacct utk router ini (sumber kebenaran trafik)
  const liveAcct = await prisma.radAcct.findMany({
    where: { nasIpAddress: router.ipAddress, acctStopTime: null },
    orderBy: { acctStartTime: "desc" },
  });

  const dbLive = await prisma.session.findMany({
    where: { nasId: router.id, stoppedAt: null },
    select: {
      id: true,
      extKey: true,
      customerId: true,
      customerUsername: true,
      startedAt: true,
      inputBytes: true,
      outputBytes: true,
      durationSeconds: true,
    },
  });
  const byExt = new Map(dbLive.map((s) => [s.extKey ?? "", s]));

  // CREATE + UPDATE (berdasarkan radacct)
  for (const acct of liveAcct) {
    const username = acct.username ?? "";
    if (!username) continue;
    const extKey = acct.acctUniqueId;
    const existing = byExt.get(extKey);
    const startAt = acct.acctStartTime ?? now;

    if (existing) {
      await prisma.session.update({
        where: { id: existing.id },
        data: {
          inputBytes: acct.acctInputOctets ?? 0n,
          outputBytes: acct.acctOutputOctets ?? 0n,
          durationSeconds: Number(acct.acctSessionTime ?? 0),
          startedAt: startAt,
        },
      });
      mark.updated += 1;
    } else {
      const id = `sess-${router.id}-${extKey}`;
      const customer = await prisma.customer.findUnique({
        where: { username },
        select: { id: true },
      });
      await prisma.session.create({
        data: {
          id,
          customerId: customer?.id ?? null, // sesi tak dikenal → null
          customerUsername: username,
          nasId: router.id,
          nasIpAddress: router.ipAddress,
          framedIp: acct.framedIpAddress?.toString() ?? null,
          startedAt: startAt,
          durationSeconds: Number(acct.acctSessionTime ?? 0),
          inputBytes: acct.acctInputOctets ?? 0n,
          outputBytes: acct.acctOutputOctets ?? 0n,
          extKey,
        },
      });
      if (customer) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { currentSessionId: id, lastSeenAt: now },
        });
      }
      mark.created += 1;
    }
  }

  // CLOSE — ada di DB tapi sudah tidak online di radacct.
  // (disconnect dilakukan inline — tanpa import route Next yang bisa
  //  menggantung proses luar; kick API router dilakukan best-effort.)
  const acctIds = new Set(liveAcct.map((a) => a.acctUniqueId));
  for (const s of dbLive) {
    if (!s.extKey || !acctIds.has(s.extKey)) {
      const cause = await lookupTerminateCause(s.customerUsername, s.startedAt);
      const nowClose = new Date();
      const elapsed = Math.max(
        1,
        Math.floor((nowClose.getTime() - s.startedAt.getTime()) / 1000),
      );
      await prisma.session.update({
        where: { id: s.id },
        data: {
          stoppedAt: nowClose,
          durationSeconds: elapsed,
          terminateCause: cause ?? "Lost-Carrier",
        },
      });
      if (s.customerId) {
        await prisma.customer.update({
          where: { id: s.customerId },
          data: { currentSessionId: null, lastSeenAt: nowClose },
        });
      }
      mark.closed += 1;
    }
  }

  // 3) Rebuild log sesi portal + update heartbeat router
  await syncPortalSessionLogs(prisma);
  await prisma.nasRouter.update({
    where: { id: router.id },
    data: { lastSyncedAt: now },
  });

  // 4) Perbarui hub realtime + broadcast — UI near-instant
  const live = await buildRouterLiveSnapshots(router.id);
  setLiveSnapshots(live, new Date());
  publishMikrotikSync(live);

  return mark;
}

/** Cari acctterminatecause terbaru dari radacct utk sesi tsb. */
async function lookupTerminateCause(
  username: string,
  startedAt: Date,
): Promise<string | null> {
  try {
    const acct = await prisma.radAcct.findFirst({
      where: {
        username,
        acctStartTime: { lte: startedAt },
        acctTerminateCause: { not: null },
      },
      orderBy: { acctStopTime: "desc" },
      select: { acctTerminateCause: true },
    });
    return acct?.acctTerminateCause ?? null;
  } catch {
    return null;
  }
}

/** Bangun snapshot live untuk satu router (pakai DB live). */
async function buildRouterLiveSnapshots(
  nasId: string,
): Promise<LiveSnapshot[]> {
  const rows = await prisma.session.findMany({
    where: { nasId, stoppedAt: null },
    orderBy: { startedAt: "desc" },
    take: 500,
  });
  return rows.map((r) => ({
    key: {
      nasId: r.nasId,
      customerUsername: r.customerUsername,
      framedIp: r.framedIp,
      startedAt: r.startedAt.toISOString(),
    },
    session: {
      id: r.id,
      customerId: r.customerId,
      customerUsername: r.customerUsername,
      nasId: r.nasId,
      nasIpAddress: r.nasIpAddress,
      framedIp: r.framedIp ?? undefined,
      startedAt: r.startedAt.toISOString(),
      stoppedAt: undefined,
      durationSeconds: r.durationSeconds,
      inputBytes: Number(r.inputBytes),
      outputBytes: Number(r.outputBytes),
      extKey: r.extKey ?? undefined,
    },
  }));
}
