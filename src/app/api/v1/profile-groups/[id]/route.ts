import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import {
  removePppProfileFromRouter,
  syncAreaGroupToRouters,
} from "@/lib/mikrotik-ppp-profile";
import { prisma } from "@/lib/prisma";
import { syncAreaGroupRadiusBulk } from "@/lib/radsync";

interface Params {
  params: Promise<{ id: string }>;
}

export const GET = asyncApi(async (_req: Request, { params }: Params) => {
  await requirePermission("profile.read");
  const { id } = await params;

  const group = await prisma.areaGroup.findUnique({
    where: { id },
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
  });

  if (!group) {
    return NextResponse.json(
      { error: "Wilayah (Area Group) tidak ditemukan." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      id: group.id,
      name: group.name,
      description: group.description,
      serviceType: group.serviceType,
      routers: group.routers,
      pppProfiles: group.pppProfiles.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      routerCount: group._count.routers,
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
  const nasIds: string[] | undefined = Array.isArray(body.nasIds)
    ? body.nasIds
    : undefined;
  const pppProfileIds: string[] | undefined = Array.isArray(body.pppProfileIds)
    ? body.pppProfileIds
    : undefined;

  const existingAreaGroup = await prisma.areaGroup.findUnique({
    where: { id },
    include: {
      routers: true,
      pppProfiles: true,
    },
  });

  if (!existingAreaGroup) {
    throw new Error("Wilayah (Area Group) tidak ditemukan.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {
      name,
      description,
      serviceType,
    };

    if (nasIds !== undefined) {
      updateData.routers = {
        set: nasIds.map((rId) => ({ id: rId })),
      };
    }

    await tx.areaGroup.update({
      where: { id },
      data: updateData,
    });

    if (pppProfileIds !== undefined) {
      // Unlink profiles that are no longer in this area
      await tx.pppProfile.updateMany({
        where: {
          areaGroupId: id,
          id: { notIn: pppProfileIds },
        },
        data: { areaGroupId: null },
      });

      // Link newly selected profiles
      if (pppProfileIds.length > 0) {
        await tx.pppProfile.updateMany({
          where: { id: { in: pppProfileIds } },
          data: { areaGroupId: id },
        });
      }
    }

    await syncAreaGroupRadiusBulk(tx, id);

    return tx.areaGroup.findUnique({
      where: { id },
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

  if (!updated) throw new Error("Gagal mengupdate Wilayah (Area Group).");

  const syncResults: string[] = [];

  // 1. Profil yang di-uncheck (dilepas dari wilayah ini) -> hapus dari seluruh router di wilayah ini
  if (pppProfileIds !== undefined) {
    const removedProfiles = existingAreaGroup.pppProfiles.filter(
      (p) => !pppProfileIds.includes(p.id),
    );
    for (const p of removedProfiles) {
      for (const r of existingAreaGroup.routers) {
        if (r.status !== "offline") {
          try {
            const delRes = await removePppProfileFromRouter(
              r.id,
              p.name,
              p.serviceType || existingAreaGroup.serviceType,
            );
            syncResults.push(delRes.message);
          } catch (err) {
            console.warn(
              `[area-group-update] Gagal hapus profile ${p.name} di router ${r.name}:`,
              err,
            );
          }
        }
      }
    }
  }

  // 2. Router NAS yang di-uncheck (dilepas dari wilayah ini) -> hapus seluruh profil wilayah ini dari router tersebut
  if (nasIds !== undefined) {
    const removedRouters = existingAreaGroup.routers.filter(
      (r) => !nasIds.includes(r.id),
    );
    for (const r of removedRouters) {
      if (r.status !== "offline") {
        for (const p of existingAreaGroup.pppProfiles) {
          try {
            const delRes = await removePppProfileFromRouter(
              r.id,
              p.name,
              p.serviceType || existingAreaGroup.serviceType,
            );
            syncResults.push(delRes.message);
          } catch (err) {
            console.warn(
              `[area-group-update] Gagal hapus profile ${p.name} di router ${r.name}:`,
              err,
            );
          }
        }
      }
    }
  }

  // 3. Sinkronisasi otomatis ke semua router MikroTik yang tetap terhubung
  try {
    const syncRes = await syncAreaGroupToRouters(updated.id);
    syncResults.push(...syncRes.results);
  } catch (err) {
    console.warn(`[area-group-update] Auto sync ke router gagal:`, err);
  }

  return NextResponse.json({
    data: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      serviceType: updated.serviceType,
      routers: updated.routers,
      pppProfiles: updated.pppProfiles.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      routerCount: updated._count.routers,
      pppProfileCount: updated._count.pppProfiles,
      customerCount: updated._count.customers,
      syncResults,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});

export const DELETE = asyncApi(async (_req: Request, { params }: Params) => {
  await requirePermission("profile.delete");
  const { id } = await params;

  const count = await prisma.customer.count({
    where: { areaGroupId: id },
  });
  if (count > 0) {
    throw new Error(
      `Wilayah tidak dapat dihapus karena masih digunakan oleh ${count} pelanggan.`,
    );
  }

  const existingAreaGroup = await prisma.areaGroup.findUnique({
    where: { id },
    include: {
      routers: true,
      pppProfiles: true,
    },
  });

  await prisma.$transaction(async (tx) => {
    // Unlink any PPP profiles attached
    await tx.pppProfile.updateMany({
      where: { areaGroupId: id },
      data: { areaGroupId: null },
    });
    await tx.areaGroup.delete({ where: { id } });
  });

  // Hapus seluruh profil wilayah dari seluruh router terkait
  if (existingAreaGroup) {
    for (const r of existingAreaGroup.routers) {
      if (r.status !== "offline") {
        for (const p of existingAreaGroup.pppProfiles) {
          try {
            await removePppProfileFromRouter(
              r.id,
              p.name,
              p.serviceType || existingAreaGroup.serviceType,
            );
          } catch (err) {
            console.warn(
              `[area-group-delete] Gagal hapus profile ${p.name} di router ${r.name}:`,
              err,
            );
          }
        }
      }
    }
  }

  return NextResponse.json({ data: { id, deleted: true } });
});
