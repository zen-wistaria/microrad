import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import {
  removePppProfileFromRouter,
  syncSingleProfileToRouters,
} from "@/lib/mikrotik-ppp-profile";
import { prisma } from "@/lib/prisma";
import {
  cleanupPppProfileIpPool,
  syncAreaGroupRadiusBulk,
  syncPppProfileIpPool,
} from "@/lib/radsync";
import { validatePppProfileIps } from "../route";

interface Params {
  params: Promise<{ id: string }>;
}

export const GET = asyncApi(async (_req: Request, { params }: Params) => {
  await requirePermission("profile.read");
  const { id } = await params;

  const profile = await prisma.pppProfile.findUnique({
    where: { id },
    include: {
      areaGroup: {
        select: { id: true, name: true },
      },
    },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Profile tidak ditemukan." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      ...profile,
      type: profile.serviceType,
      profileGroupId: profile.areaGroupId,
      profileGroup: profile.areaGroup,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    },
  });
});

export const PUT = asyncApi(async (req: Request, { params }: Params) => {
  await requirePermission("profile.update");
  const { id } = await params;
  const body = await req.json();

  const name = body.name?.trim();
  if (!name) throw new Error("Nama Profile wajib diisi.");

  const serviceType = (body.serviceType || body.type || "PPP").toUpperCase();
  const ipModule = body.ipModule || "sql";
  const localAddress = body.localAddress?.trim() || null;
  const rangeIpStart = body.rangeIpStart?.trim() || null;
  const rangeIpEnd = body.rangeIpEnd?.trim() || null;
  const dnsServers = body.dnsServers?.trim() || "8.8.8.8,8.8.4.4";
  const sessionTimeout = body.sessionTimeout
    ? parseInt(String(body.sessionTimeout), 10)
    : null;
  const idleTimeout = body.idleTimeout
    ? parseInt(String(body.idleTimeout), 10)
    : null;
  const parentQueue = body.parentQueue?.trim() || null;

  // Khusus Hotspot
  const insertQueueBefore = body.insertQueueBefore?.trim() || null;
  const keepaliveTimeout = body.keepaliveTimeout?.trim() || null;
  const addMacCookie = Boolean(body.addMacCookie);
  const macCookieTimeout = body.macCookieTimeout?.trim() || null;

  const areaGroupId =
    body.areaGroupId?.trim() || body.profileGroupId?.trim() || null;

  if (rangeIpStart && rangeIpEnd) {
    validatePppProfileIps(localAddress, rangeIpStart, rangeIpEnd);
  }

  if (areaGroupId) {
    const area = await prisma.areaGroup.findUnique({
      where: { id: areaGroupId },
    });
    if (!area) throw new Error("Wilayah (Area Group) tidak ditemukan.");
  }

  const existingProfile = await prisma.pppProfile.findUnique({
    where: { id },
  });

  const updated = await prisma.$transaction(async (tx) => {
    const ppp = await tx.pppProfile.update({
      where: { id },
      data: {
        name,
        serviceType,
        ipModule,
        localAddress,
        rangeIpStart,
        rangeIpEnd,
        dnsServers,
        sessionTimeout,
        idleTimeout,
        parentQueue,
        insertQueueBefore,
        keepaliveTimeout,
        addMacCookie,
        macCookieTimeout,
        areaGroupId,
      },
      include: {
        areaGroup: {
          select: { id: true, name: true },
        },
      },
    });

    await syncPppProfileIpPool(tx, id, existingProfile?.name);
    if (ppp.areaGroupId) {
      await syncAreaGroupRadiusBulk(tx, ppp.areaGroupId);
    }
    if (
      existingProfile?.areaGroupId &&
      existingProfile.areaGroupId !== ppp.areaGroupId
    ) {
      await syncAreaGroupRadiusBulk(tx, existingProfile.areaGroupId);
    }
    return ppp;
  });

  // Otomatis sinkronisasi pembaruan profile ke seluruh router di Wilayah terkait via API
  let syncResults: string[] = [];
  if (updated.areaGroupId) {
    try {
      const syncRes = await syncSingleProfileToRouters(
        updated.id,
        existingProfile?.name,
      );
      syncResults = syncRes.results;
    } catch (err) {
      console.warn(`[ppp-profile-update] Auto sync ke router gagal:`, err);
    }
  }

  // Jika sebelumnya profil terdaftar di Area Group lain dan sekarang pindah, hapus dari router di area lama
  if (
    existingProfile?.areaGroupId &&
    existingProfile.areaGroupId !== updated.areaGroupId &&
    existingProfile.name
  ) {
    const oldArea = await prisma.areaGroup.findUnique({
      where: { id: existingProfile.areaGroupId },
      include: { routers: true },
    });
    if (oldArea?.routers) {
      for (const r of oldArea.routers) {
        if (r.status !== "offline") {
          try {
            await removePppProfileFromRouter(
              r.id,
              existingProfile.name,
              existingProfile.serviceType,
            );
          } catch {}
        }
      }
    }
  }

  return NextResponse.json({
    data: {
      ...updated,
      type: updated.serviceType,
      profileGroupId: updated.areaGroupId,
      profileGroup: updated.areaGroup,
      syncResults,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});

export const DELETE = asyncApi(async (_req: Request, { params }: Params) => {
  await requirePermission("profile.delete");
  const { id } = await params;

  const existingProfile = await prisma.pppProfile.findUnique({
    where: { id },
    include: {
      areaGroup: {
        include: { routers: true },
      },
    },
  });

  await prisma.$transaction(async (tx) => {
    await tx.pppProfile.delete({ where: { id } });
    if (existingProfile?.name) {
      await cleanupPppProfileIpPool(tx, existingProfile.name);
    }
    if (existingProfile?.areaGroupId) {
      await syncAreaGroupRadiusBulk(tx, existingProfile.areaGroupId);
    }
  });

  // Hapus profile dari semua router di area terkait
  if (existingProfile?.areaGroup?.routers && existingProfile.name) {
    for (const router of existingProfile.areaGroup.routers) {
      try {
        await removePppProfileFromRouter(
          router.id,
          existingProfile.name,
          existingProfile.serviceType,
        );
      } catch (err) {
        console.warn(
          `[ppp-profile-delete] Gagal hapus di router ${router.name}:`,
          err,
        );
      }
    }
  }

  return NextResponse.json({ data: { id, deleted: true } });
});
