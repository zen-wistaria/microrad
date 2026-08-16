import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { connectRouterOS } from "@/lib/mikrotik-client";
import { prisma } from "@/lib/prisma";
import { removeRadiusFromRouter } from "@/lib/radius-router";

type Params = Promise<{ id: string }>;

/** Putuskan MikroTik dari FreeRADIUS (hapus entri radius + use-radius=no). */
export const POST = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("router.update");
  const { id } = await ctx.params;
  const router = await prisma.nasRouter.findUnique({ where: { id } });
  if (!router) throw new Error("Router tidak ditemukan.");
  if (!router.apiUsername) {
    throw new Error("Kredensial API RouterOS belum diisi pada router ini.");
  }
  const mikrotik = await connectRouterOS(router);
  try {
    const removed = await removeRadiusFromRouter(mikrotik);
    await prisma.nasRouter.update({
      where: { id },
      data: { radiusEnabled: false, lastSyncedAt: new Date() },
    });
    return NextResponse.json({ data: { radiusEnabled: false, removed } });
  } finally {
    mikrotik.close();
  }
});
