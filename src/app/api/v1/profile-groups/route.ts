import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { syncAreaGroupToRouters } from "@/lib/mikrotik-profile";
import { prisma } from "@/lib/prisma";
import { syncAreaGroupRadiusBulk } from "@/lib/radsync";

export const GET = asyncApi(async (req: Request) => {
  await requirePermission("profile.read");
  const url = new URL(req.url);
  const search = url.searchParams.get("search") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);

  const safeLimit = Math.min(Math.max(limit || 10, 1), 50);
  const safePage = Math.max(page || 1, 1);

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, groups] = await Promise.all([
    prisma.areaGroup.count({ where }),
    prisma.areaGroup.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      include: {
        routers: {
          select: { id: true, name: true, ipAddress: true, status: true },
        },
        pppProfiles: true,
        _count: {
          select: {
            routers: true,
            pppProfiles: true,
            customers: true,
          },
        },
      },
    }),
  ]);

  const data = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    serviceType: g.serviceType,
    routers: g.routers,
    pppProfiles: g.pppProfiles.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    routerCount: g._count.routers,
    pppProfileCount: g._count.pppProfiles,
    customerCount: g._count.customers,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  }));

  return NextResponse.json({ data, total });
});

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("profile.create");
  const body = await req.json();

  const name = body.name?.trim();
  if (!name) throw new Error("Nama Wilayah (Area Group) wajib diisi.");

  const description = body.description?.trim() || null;
  const rawServiceType = body.serviceType
    ? String(body.serviceType).trim()
    : "PPP";
  const validTypes: string[] = [];
  if (rawServiceType.toUpperCase().includes("PPP")) validTypes.push("PPP");
  if (rawServiceType.toUpperCase().includes("HOTSPOT"))
    validTypes.push("HOTSPOT");
  const serviceType = validTypes.length > 0 ? validTypes.join(",") : "PPP";
  const nasIds: string[] = Array.isArray(body.nasIds) ? body.nasIds : [];
  const pppProfileIds: string[] = Array.isArray(body.pppProfileIds)
    ? body.pppProfileIds
    : [];

  const created = await prisma.$transaction(async (tx) => {
    const group = await tx.areaGroup.create({
      data: {
        id: `area-${Date.now()}`,
        name,
        description,
        serviceType,
        routers: {
          connect: nasIds.map((id) => ({ id })),
        },
      },
    });

    if (pppProfileIds.length > 0) {
      await tx.pppProfile.updateMany({
        where: { id: { in: pppProfileIds } },
        data: { areaGroupId: group.id },
      });
    }

    // Sinkronisasi radius bulk untuk area baru jika ada
    await syncAreaGroupRadiusBulk(tx, group.id);

    return tx.areaGroup.findUnique({
      where: { id: group.id },
      include: {
        routers: {
          select: { id: true, name: true, ipAddress: true, status: true },
        },
        pppProfiles: true,
        _count: {
          select: { routers: true, pppProfiles: true, customers: true },
        },
      },
    });
  });

  if (!created) throw new Error("Gagal membuat Wilayah (Area Group).");

  // Sinkronisasi otomatis profile ke seluruh router MikroTik yang terhubung
  let syncResults: string[] = [];
  try {
    const syncRes = await syncAreaGroupToRouters(created.id);
    syncResults = syncRes.results;
  } catch (err) {
    console.warn(`[area-group-create] Auto sync ke router gagal:`, err);
  }

  return NextResponse.json(
    {
      data: {
        id: created.id,
        name: created.name,
        description: created.description,
        serviceType: created.serviceType,
        routers: created.routers,
        pppProfiles: created.pppProfiles.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        })),
        routerCount: created._count.routers,
        pppProfileCount: created._count.pppProfiles,
        customerCount: created._count.customers,
        syncResults,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    },
    { status: 201 },
  );
});
