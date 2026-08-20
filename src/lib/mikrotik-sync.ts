/**
 * Poller sinkronisasi sesi PPPoE dari MikroTik (node-routeros) ke tabel
 * Session aplikasi. Dijalankan dari src/instrumentation.ts (server Node).
 *
 * Algoritma per tick per router (router yang punya apiUsername+syncEnabled):
 *   CREATE  — ada di /ppp/active tapi belum di DB  → insert Session
 *   UPDATE  — ada di keduanya                       → snapshot bytes/uptime
 *   CLOSE   — ada di DB live tapi hilang dari router → tutup (stoppedAt)
 * Router yang gagal dijangkau → status offline (+ lastSeenAt).
 */
import { disconnectSessionRecord } from "@/app/api/v1/customers/[id]/route";
import { connectRouterOS } from "./mikrotik-client";
import { syncPortalSessionLogs } from "./portal-logs";
import { prisma } from "./prisma";
import { parseActiveRow } from "./radius-parsers";

export interface SyncSummary {
  created: number;
  updated: number;
  closed: number;
  error?: string;
}

const g = globalThis as unknown as { __mikrotikSyncStarted?: boolean };

export function startMikrotikSync(): void {
  if (g.__mikrotikSyncStarted) return; // aman dari HMR dev
  if (process.env.MIKROTIK_SYNC_ENABLED === "false") return;
  g.__mikrotikSyncStarted = true;

  const intervalMs = () =>
    Number(process.env.MIKROTIK_SYNC_INTERVAL_MS ?? "10000");

  const tick = async () => {
    try {
      await syncAllRouters();
    } catch (e) {
      console.error("[mikrotik-sync] tick error:", e);
    }
  };

  // Tick pertama segera (status router cepat akurat), lalu interval
  void tick();
  const id = setInterval(() => void tick(), intervalMs());
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
  let conn: Awaited<ReturnType<typeof connectRouterOS>> | null = null;
  try {
    conn = await connectRouterOS(router);
    const rows = await conn.write("/ppp/active/print");
    const active = rows
      .map(parseActiveRow)
      .filter(
        (r): r is NonNullable<typeof r> => r !== null && r.service === "pppoe",
      );

    // Simpan status online di awal (sebelum kerja DB) — bukti heartbeat
    await prisma.nasRouter.update({
      where: { id: router.id },
      data: { status: "online", lastSeenAt: now },
    });

    // DB live untuk router ini
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

    // CREATE + UPDATE
    for (const row of active) {
      const existing = byExt.get(row.sessionId);
      if (existing) {
        await prisma.session.update({
          where: { id: existing.id },
          data: {
            inputBytes: row.bytesIn,
            outputBytes: row.bytesOut,
            durationSeconds: row.uptimeSec,
            // koreksi drift start (maks sekali/5 menit)
            ...(Math.abs(existing.durationSeconds - row.uptimeSec) > 300
              ? {
                  startedAt: new Date(now.getTime() - row.uptimeSec * 1000),
                }
              : {}),
          },
        });
        mark.updated += 1;
      } else {
        const startedAt = new Date(now.getTime() - row.uptimeSec * 1000);
        const id = `sess-${router.id}-${row.sessionId}`;
        const customer = await prisma.customer.findUnique({
          where: { username: row.name },
          select: { id: true },
        });
        await prisma.session.create({
          data: {
            id,
            customerId: customer?.id ?? null, // sesi tak dikenal → null
            customerUsername: row.name,
            nasId: router.id,
            nasIpAddress: router.ipAddress,
            framedIp: row.address ?? null,
            startedAt,
            durationSeconds: row.uptimeSec,
            inputBytes: row.bytesIn,
            outputBytes: row.bytesOut,
            extKey: row.sessionId,
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

    // CLOSE — ada di DB tapi hilang dari RouterOS
    const activeIds = new Set(active.map((r) => r.sessionId));
    for (const s of dbLive) {
      if (!s.extKey || !activeIds.has(s.extKey)) {
        const cause = await lookupTerminateCause(
          s.customerUsername,
          s.startedAt,
        );
        await disconnectSessionRecord(s.id, cause ?? "Lost-Carrier");
        mark.closed += 1;
      }
    }
    // Sinkronkan log sesi portal (agar "Log Sesi" portal terisi riwayat)
    await syncPortalSessionLogs(prisma);

    await prisma.nasRouter.update({
      where: { id: router.id },
      data: { lastSyncedAt: now },
    });
  } catch (err) {
    mark.error = err instanceof Error ? err.message : String(err);
    await prisma.nasRouter.update({
      where: { id: router.id },
      data: { status: "offline", lastSeenAt: now },
    });
  } finally {
    conn?.close();
  }
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
