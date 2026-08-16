import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const GET = asyncApi(async () => {
  await requirePermission("router.read");
  const routers = await prisma.nasRouter.findMany({
    orderBy: { name: "asc" },
  });
  const activeCounts = await prisma.session.groupBy({
    by: ["nasId"],
    where: { stoppedAt: null },
    _count: { _all: true },
  });
  const countMap = new Map(activeCounts.map((c) => [c.nasId, c._count._all]));
  const data = routers.map((r) => ({
    ...r,
    activeSessionCount: countMap.get(r.id) ?? 0,
  }));
  return NextResponse.json({ data });
});

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("router.create");
  const body = (await req.json()) as {
    name?: string;
    ipAddress?: string;
    location?: string;
    status?: string;
  };
  const name = body.name?.trim();
  const ipAddress = body.ipAddress?.trim();
  if (!name) throw new Error("Nama router NAS tidak boleh kosong.");
  if (!ipAddress) throw new Error("IP Address router tidak boleh kosong.");

  const dup = await prisma.nasRouter.findUnique({ where: { ipAddress } });
  if (dup) throw new Error(`IP Address '${ipAddress}' sudah terdaftar.`);

  const router = await prisma.nasRouter.create({
    data: {
      id: `nas-${Date.now()}`,
      name,
      ipAddress,
      location: body.location?.trim() || undefined,
      status: body.status ?? "online",
      type: "mikrotik",
    },
  });
  return NextResponse.json(
    { data: { ...router, activeSessionCount: 0 } },
    { status: 201 },
  );
});
