import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const GET = asyncApi(async () => {
  await requirePermission("profile.read");

  const groups = await prisma.profileGroup.findMany({
    orderBy: { name: "asc" },
    include: {
      pppProfiles: {
        include: {
          nasRouter: {
            select: { id: true, name: true, ipAddress: true },
          },
        },
      },
      _count: {
        select: {
          pppProfiles: true,
          customers: true,
        },
      },
    },
  });

  const data = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    pppProfiles: g.pppProfiles.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    pppProfileCount: g._count.pppProfiles,
    customerCount: g._count.customers,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  }));

  return NextResponse.json({ data });
});

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("profile.create");
  const body = await req.json();

  const name = body.name?.trim();
  if (!name) throw new Error("Nama Profile Group (Wilayah) wajib diisi.");

  const description = body.description?.trim() || null;
  const pppProfileIds: string[] = Array.isArray(body.pppProfileIds)
    ? body.pppProfileIds
    : [];

  const created = await prisma.$transaction(async (tx) => {
    const group = await tx.profileGroup.create({
      data: {
        id: `grp-${Date.now()}`,
        name,
        description,
      },
    });

    if (pppProfileIds.length > 0) {
      await tx.pppProfile.updateMany({
        where: { id: { in: pppProfileIds } },
        data: { profileGroupId: group.id },
      });
    }

    return tx.profileGroup.findUnique({
      where: { id: group.id },
      include: {
        pppProfiles: {
          include: {
            nasRouter: {
              select: { id: true, name: true, ipAddress: true },
            },
          },
        },
        _count: {
          select: { pppProfiles: true, customers: true },
        },
      },
    });
  });

  if (!created) throw new Error("Gagal membuat Profile Group.");

  return NextResponse.json(
    {
      data: {
        id: created.id,
        name: created.name,
        description: created.description,
        pppProfiles: created.pppProfiles.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        })),
        pppProfileCount: created._count.pppProfiles,
        customerCount: created._count.customers,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    },
    { status: 201 },
  );
});
