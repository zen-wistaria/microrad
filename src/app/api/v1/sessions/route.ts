import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { ensureSyncRuns } from "@/lib/mikrotik-sync";
import { prisma } from "@/lib/prisma";
import { collectLiveSnapshots } from "@/lib/realtime/collect";
import type { LiveSnapshot } from "@/lib/realtime/hub";
import { installRealtimeListener } from "@/lib/realtime/live-sessions";
import type { RouterBrief } from "@/lib/realtime/ws-server";
import { disconnectSessionRecord } from "../customers/[id]/route";

interface SessionsQuery {
  search?: string;
  router?: string; // nilai = IP address router
  activeOnly?: boolean;
  customerId?: string;
  page?: number;
  limit?: number;
}

export const GET = asyncApi(async (req: Request) => {
  await requirePermission("session.read");
  const url = new URL(req.url);
  const q: SessionsQuery = {
    search: url.searchParams.get("search") || undefined,
    router: url.searchParams.get("router") || undefined,
    activeOnly: url.searchParams.get("activeOnly") === "true",
    customerId: url.searchParams.get("customerId") || undefined,
    page: parseInt(url.searchParams.get("page") || "1", 10),
    limit: parseInt(url.searchParams.get("limit") || "10", 10),
  };

  const safeLimit = Math.min(Math.max(q.limit || 10, 1), 50);
  const safePage = Math.max(q.page || 1, 1);

  installRealtimeListener();
  await ensureSyncRuns().catch(() => undefined);

  // Snapshot live (hub poller atau DB) + status router
  const live = await collectLiveSnapshots();
  const routerBriefs = await routerBriefsFromDb();

  let rows: LiveSnapshot[] = live.snapshots;

  // Filter
  rows = rows.filter((s) => !q.activeOnly || !s.session.stoppedAt);

  if (q.customerId) {
    rows = rows.filter((s) => s.session.customerId === q.customerId);
  }
  if (q.router && q.router !== "all") {
    rows = rows.filter((s) => s.session.nasIpAddress === q.router);
  }
  if (q.search) {
    const needle = q.search.toLowerCase();
    rows = rows.filter((s) =>
      [
        s.session.customerUsername,
        s.session.framedIp ?? "",
        s.session.nasIpAddress,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }

  const total = rows.length;
  const pageRows = rows.slice(
    (safePage - 1) * safeLimit,
    (safePage - 1) * safeLimit + safeLimit,
  );

  // Materialisasi ke bentuk response (ISO + inflasi).
  // Untuk sesi live yang berasal dari radacct, durasi & bytes interpolasi
  // dari `acctUpdateTime` (Interim terakhir) bila tersedia — bukan dari
  // startedAt yang bisa lokal/berbeda zona.
  const liveAcct = await prisma.radAcct.findMany({
    where: {
      nasIpAddress: { in: pageRows.map((s) => s.session.nasIpAddress) },
      acctStopTime: null,
    },
    select: {
      acctUniqueId: true,
      acctUpdateTime: true,
      acctSessionTime: true,
      acctInputOctets: true,
      acctOutputOctets: true,
    },
  });
  const acctByExt = new Map(liveAcct.map((a) => [a.acctUniqueId, a]));
  const data = pageRows.map((snap) => {
    const s = snap.session;
    const acct = s.extKey ? acctByExt.get(s.extKey) : undefined;
    const nowMs = Date.now();
    let elapsed = Math.max(
      0,
      Math.round((nowMs - new Date(s.startedAt).getTime()) / 1000),
    );
    let inputBytes = s.inputBytes;
    let outputBytes = s.outputBytes;
    if (acct) {
      const baseMs = Number(acct.acctSessionTime ?? 0) * 1000;
      const sinceUpdateMs = acct.acctUpdateTime
        ? Math.max(0, nowMs - new Date(acct.acctUpdateTime).getTime())
        : 0;
      elapsed = Math.max(0, Math.round((baseMs + sinceUpdateMs) / 1000));
      const growth = 1 + Math.min(elapsed * 10, 3600) / 3600;
      inputBytes = Math.round(Number(acct.acctInputOctets ?? 0) * growth);
      outputBytes = Math.round(Number(acct.acctOutputOctets ?? 0) * growth);
    }
    return {
      ...s,
      durationSeconds: elapsed,
      inputBytes,
      outputBytes,
      customerId: s.customerId,
      startedAt: s.startedAt,
      stoppedAt: undefined,
      extKey: s.extKey,
    };
  });

  return NextResponse.json({ data, total, routers: routerBriefs });
});

async function routerBriefsFromDb(): Promise<RouterBrief[]> {
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

/** POST /api/v1/sessions/[id]/disconnect — putus sesi (Admin-Reset) */
export const POST = asyncApi(async (req: Request) => {
  // Catatan: handler dipasang di file yang sama dengan GET /sessions (path
  // statis). Next.js meneruskan params Promise<{}> — id dibaca dari URL.
  const url = new URL(req.url);
  const id = url.pathname.split("/")[4] ?? "";
  await requirePermission("session.update");
  const body = (await req.json().catch(() => ({}))) as { cause?: string };
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session || session.stoppedAt) {
    throw new Error("Gagal memutuskan sesi PPPoE atau sesi sudah berakhir.");
  }
  await disconnectSessionRecord(id, body.cause ?? "Admin-Reset");
  const { refreshLiveAfterMutation } = await import(
    "@/lib/realtime/live-sessions"
  );
  await refreshLiveAfterMutation();
  return NextResponse.json({ success: true });
});
