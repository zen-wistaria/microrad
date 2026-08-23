import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

interface Params {
  params: Promise<{ id: string }>;
}

export const GET = asyncApi(async (_req: Request, { params }: Params) => {
  await requirePermission("profile.read");
  const { id } = await params;

  const group = await prisma.profileGroup.findUnique({
    where: { id },
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

  if (!group) {
    return NextResponse.json(
      { error: "Profile Group tidak ditemukan." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      id: group.id,
      name: group.name,
      description: group.description,
      pppProfiles: group.pppProfiles.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      pppProfileCount: group._count.pppProfiles,
      customerCount: group._count.customers,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    },
  });
});

export const PUT = asyncApi(async (req: Request, { params }: Params) => {
  await requirePermission("profile.update");
  const { id } = await params;
  const body = await req.json();

  const name = body.name?.trim();
  if (!name) throw new Error("Nama Profile Group (Wilayah) wajib diisi.");

  const description = body.description?.trim() || null;
  const pppProfileIds: string[] | undefined = Array.isArray(body.pppProfileIds)
    ? body.pppProfileIds
    : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.profileGroup.update({
      where: { id },
      data: {
        name,
        description,
      },
    });

    if (pppProfileIds !== undefined) {
      // Unlink profiles that are no longer in the list
      await tx.pppProfile.updateMany({
        where: {
          profileGroupId: id,
          id: { notIn: pppProfileIds },
        },
        data: { profileGroupId: null },
      });

      // Link newly selected profiles
      if (pppProfileIds.length > 0) {
        await tx.pppProfile.updateMany({
          where: { id: { in: pppProfileIds } },
          data: { profileGroupId: id },
        });
      }
    }

    return tx.profileGroup.findUnique({
      where: { id },
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

  if (!updated) throw new Error("Gagal mengupdate Profile Group.");

  return NextResponse.json({
    data: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      pppProfiles: updated.pppProfiles.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      pppProfileCount: updated._count.pppProfiles,
      customerCount: updated._count.customers,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});

export const DELETE = asyncApi(async (_req: Request, { params }: Params) => {
  await requirePermission("profile.delete");
  const { id } = await params;

  const count = await prisma.customer.count({
    where: { profileGroupId: id },
  });
  if (count > 0) {
    throw new Error(
      `Profile Group tidak dapat dihapus karena masih digunakan oleh ${count} pelanggan.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    // Unlink any PPP profiles attached
    await tx.pppProfile.updateMany({
      where: { profileGroupId: id },
      data: { profileGroupId: null },
    });
    await tx.profileGroup.delete({ where: { id } });
  });

  return NextResponse.json({ data: { id, deleted: true } });
});
