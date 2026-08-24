import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { ensureSyncRuns } from "@/lib/mikrotik-sync";
import { prisma } from "@/lib/prisma";
import { syncRouterNas } from "@/lib/radsync";

export const GET = asyncApi(async (req: Request) => {
  await requirePermission("router.read");
  ensureSyncRuns();
  const url = new URL(req.url);
  const search = url.searchParams.get("search") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "6", 10);

  const safeLimit = Math.min(Math.max(limit || 6, 1), 50);
  const safePage = Math.max(page || 1, 1);

  const where: Record<string, unknown> = {};
  if (status && status !== "all") {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { ipAddress: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, routers] = await Promise.all([
    prisma.nasRouter.count({ where }),
    prisma.nasRouter.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
  ]);

  // Sesi aktif per router = radacct online count by NAS IP (group by)
  const onlineCounts = await prisma.radAcct.groupBy({
    by: ["nasIpAddress"],
    where: { acctStopTime: null },
    _count: { _all: true },
  });
  const countByIp = new Map<string, number>();
  for (const c of onlineCounts) {
    if (!c.nasIpAddress) continue;
    countByIp.set(c.nasIpAddress, c._count._all);
  }
  const data = routers.map((r) => ({
    ...r,
    apiPassword: undefined, // jangan bocor ke client
    apiPasswordSet: r.apiPassword !== null,
    activeSessionCount: countByIp.get(r.ipAddress) ?? 0,
  }));
  return NextResponse.json({ data, total });
});

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("router.create");
  const body = (await req.json()) as {
    name?: string;
    ipAddress?: string;
    location?: string;
    apiUsername?: string;
    apiPassword?: string;
    apiPort?: number;
    radiusSecret?: string;
    syncEnabled?: boolean;
  };
  const name = body.name?.trim();
  const ipAddress = body.ipAddress?.trim();
  if (!name) throw new Error("Nama router NAS tidak boleh kosong.");
  if (!ipAddress) throw new Error("IP Address router tidak boleh kosong.");

  const dup = await prisma.nasRouter.findUnique({ where: { ipAddress } });
  if (dup) throw new Error(`IP Address '${ipAddress}' sudah terdaftar.`);

  const router = await prisma.$transaction(async (tx) => {
    const created = await tx.nasRouter.create({
      data: {
        id: `nas-${Date.now()}`,
        name,
        ipAddress,
        location: body.location?.trim() || undefined,
        type: "mikrotik",
        apiUsername: body.apiUsername?.trim() || undefined,
        apiPassword: body.apiPassword ?? "", // kosong = default RouterOS
        apiPort: body.apiPort ?? 8728,
        radiusSecret: body.radiusSecret || undefined,
        syncEnabled: body.syncEnabled ?? true,
      },
    });
    // radsync — daftarkan NAS ke FreeRADIUS (read_clients=yes)
    await syncRouterNas(tx, created);
    return created;
  });
  return NextResponse.json(
    {
      data: {
        ...router,
        apiPassword: undefined,
        apiPasswordSet: router.apiPassword !== null,
        activeSessionCount: 0,
      },
    },
    { status: 201 },
  );
});
