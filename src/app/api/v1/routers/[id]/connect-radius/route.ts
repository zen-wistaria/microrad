import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { connectRouterOS } from "@/lib/mikrotik-client";
import { prisma } from "@/lib/prisma";
import { configureRadiusOnRouter } from "@/lib/radius-router";

type Params = Promise<{ id: string }>;

/**
 * Hubungkan MikroTik ke FreeRADIUS: /radius add + /ppp aaa use-radius=yes.
 * Sekarang sesi PPPoE di router akan di-autentikasi FreeRADIUS
 * (radcheck/radreply dari DB aplikasi) + accounting ke radacct.
 */
export const POST = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("router.update");
  const { id } = await ctx.params;
  const router = await prisma.nasRouter.findUnique({ where: { id } });
  if (!router) throw new Error("Router tidak ditemukan.");
  if (!router.radiusSecret) {
    throw new Error(
      "Shared secret RADIUS belum diisi — simpan router terlebih dahulu.",
    );
  }
  if (!router.apiUsername) {
    throw new Error(
      "Kredensial API RouterOS belum diisi — simpan router terlebih dahulu.",
    );
  }
  const mikrotik = await connectRouterOS(router);
  try {
    const result = await configureRadiusOnRouter(mikrotik, router.radiusSecret);
    await prisma.nasRouter.update({
      where: { id },
      data: { radiusEnabled: true, lastSyncedAt: new Date() },
    });
    return NextResponse.json({
      data: { radiusEnabled: true, ...result },
    });
  } finally {
    mikrotik.close();
  }
});
