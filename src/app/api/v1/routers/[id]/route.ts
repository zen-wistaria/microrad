import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { triggerRadiusReload } from "@/lib/radius-router";
import { removeRouterNas, syncRouterNas } from "@/lib/radsync";

type Params = Promise<{ id: string }>;

async function routerWithCount(id: string) {
  const router = await prisma.nasRouter.findUnique({ where: { id } });
  if (!router) return null;
  const active = await prisma.radAcct.count({
    where: { nasIpAddress: router.ipAddress, acctStopTime: null },
  });
  return {
    ...router,
    apiPassword: undefined,
    apiPasswordSet: router.apiPassword !== null,
    activeSessionCount: active,
  };
}

export const GET = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("router.read");
  const { id } = await ctx.params;
  const router = await routerWithCount(id);
  if (!router) throw new Error("Router NAS tidak ditemukan.");
  return NextResponse.json({ data: router });
});

export const PUT = asyncApi(async (req: Request, ctx: { params: Params }) => {
  await requirePermission("router.update");
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    name?: string;
    ipAddress?: string;
    location?: string;
    status?: string;
    apiUsername?: string;
    apiPassword?: string;
    apiPort?: number;
    radiusSecret?: string;
    syncEnabled?: boolean;
  };

  const existing = await prisma.nasRouter.findUnique({ where: { id } });
  if (!existing) throw new Error("Router NAS tidak ditemukan.");

  if (body.ipAddress !== undefined) {
    const dup = await prisma.nasRouter.findFirst({
      where: { ipAddress: body.ipAddress.trim(), NOT: { id } },
    });
    if (dup) throw new Error(`IP Address '${body.ipAddress}' sudah terdaftar.`);
  }

  const secretChanged =
    body.radiusSecret !== undefined &&
    body.radiusSecret !== (existing.radiusSecret ?? "");
  const ipChanged =
    body.ipAddress !== undefined &&
    body.ipAddress.trim() !== existing.ipAddress;

  const router = await prisma.$transaction(async (tx) => {
    const updated = await tx.nasRouter.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.ipAddress !== undefined
          ? { ipAddress: body.ipAddress.trim() }
          : {}),
        ...(body.location !== undefined
          ? { location: body.location.trim() || undefined }
          : {}),
        // status kini DERIVED dari poller — terima manual hanya bila ada
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.apiUsername !== undefined
          ? { apiUsername: body.apiUsername.trim() || undefined }
          : {}),
        ...(body.apiPassword !== undefined
          ? { apiPassword: body.apiPassword ?? "" } // kosong = default RouterOS
          : {}),
        ...(body.apiPort !== undefined
          ? { apiPort: Math.max(1, Math.min(body.apiPort, 65535)) }
          : {}),
        ...(body.radiusSecret !== undefined
          ? { radiusSecret: body.radiusSecret || undefined }
          : {}),
        ...(body.syncEnabled !== undefined
          ? { syncEnabled: body.syncEnabled }
          : {}),
      },
    });
    // radsync — sinkronkan nas row (hapus lama bila IP berubah)
    if (ipChanged) await removeRouterNas(tx, existing.ipAddress);
    await syncRouterNas(tx, updated);
    return updated;
  });

  // Perubahan secret/IP → FreeRADIUS read_clients baru aktif setelah HUP
  if (secretChanged || ipChanged) {
    void triggerRadiusReload();
  }

  const router2 = router; // gabung data utk count
  const active = await prisma.radAcct.count({
    where: { nasIpAddress: router2.ipAddress, acctStopTime: null },
  });
  return NextResponse.json({
    data: {
      ...router,
      apiPassword: undefined,
      apiPasswordSet: router.apiPassword !== null,
      activeSessionCount: active,
    },
  });
});

export const DELETE = asyncApi(
  async (_req: Request, ctx: { params: Params }) => {
    await requirePermission("router.delete");
    const { id } = await ctx.params;

    const existing = await prisma.nasRouter.findUnique({ where: { id } });
    if (!existing) throw new Error("Router NAS tidak ditemukan.");

    const activeCount = await prisma.radAcct.count({
      where: { nasIpAddress: existing.ipAddress, acctStopTime: null },
    });
    if (activeCount > 0) {
      throw new Error(
        `Router tidak dapat dihapus karena masih memiliki ${activeCount} sesi aktif. Putuskan koneksi terlebih dahulu.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await removeRouterNas(tx, existing.ipAddress);
      await tx.nasRouter.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  },
);
