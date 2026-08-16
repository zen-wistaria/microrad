import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { disconnectSessionRecord } from "../customers/[id]/route";

interface SessionsQuery {
  search?: string;
  router?: string; // nilai = IP address router
  activeOnly?: boolean;
  customerId?: string;
  page?: number;
  limit?: number;
}

/** Inflasi sesi live saat read — mirror mock (duration=elapsed, bytes×growth) */
function inflateLive(session: {
  startedAt: Date;
  stoppedAt: Date | null;
  inputBytes: bigint;
  outputBytes: bigint;
}) {
  if (session.stoppedAt) {
    return {
      durationSeconds: Math.max(
        1,
        Math.round(
          (session.stoppedAt.getTime() - session.startedAt.getTime()) / 1000,
        ),
      ),
      inputBytes: Number(session.inputBytes),
      outputBytes: Number(session.outputBytes),
    };
  }
  const now = Date.now();
  const elapsed = Math.max(0, (now - session.startedAt.getTime()) / 1000);
  const growth = 1 + Math.min(elapsed * 10, 3600) / 3600;
  return {
    durationSeconds: Math.round(elapsed),
    inputBytes: Math.round(Number(session.inputBytes) * growth),
    outputBytes: Math.round(Number(session.outputBytes) * growth),
  };
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

  const where: Record<string, unknown> = {};
  if (q.activeOnly) where.stoppedAt = null;
  if (q.customerId) where.customerId = q.customerId;
  if (q.router && q.router !== "all") where.nasIpAddress = q.router;
  if (q.search) {
    where.OR = [
      { customerUsername: { contains: q.search, mode: "insensitive" } },
      { framedIp: { contains: q.search, mode: "insensitive" } },
      { nasIpAddress: { contains: q.search, mode: "insensitive" } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.session.count({ where }),
    prisma.session.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
  ]);

  const data = rows.map((s) => ({
    ...s,
    ...inflateLive(s),
    inputBytes: undefined,
    outputBytes: undefined,
    startedAt: s.startedAt.toISOString(),
    stoppedAt: s.stoppedAt ? s.stoppedAt.toISOString() : undefined,
  }));

  return NextResponse.json({ data, total });
});

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
  return NextResponse.json({ success: true });
});
