import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

async function routerWithCount(id: string) {
  const router = await prisma.nasRouter.findUnique({ where: { id } });
  if (!router) return null;
  const active = await prisma.session.count({
    where: { nasId: id, stoppedAt: null },
  });
  return { ...router, activeSessionCount: active };
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
  };

  const existing = await prisma.nasRouter.findUnique({ where: { id } });
  if (!existing) throw new Error("Router NAS tidak ditemukan.");

  if (body.ipAddress !== undefined) {
    const dup = await prisma.nasRouter.findFirst({
      where: { ipAddress: body.ipAddress.trim(), NOT: { id } },
    });
    if (dup) throw new Error(`IP Address '${body.ipAddress}' sudah terdaftar.`);
  }

  const router = await prisma.nasRouter.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.ipAddress !== undefined
        ? { ipAddress: body.ipAddress.trim() }
        : {}),
      ...(body.location !== undefined
        ? { location: body.location.trim() || undefined }
        : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    },
  });
  const active = await prisma.session.count({
    where: { nasId: id, stoppedAt: null },
  });
  return NextResponse.json({ data: { ...router, activeSessionCount: active } });
});

export const DELETE = asyncApi(
  async (_req: Request, ctx: { params: Params }) => {
    await requirePermission("router.delete");
    const { id } = await ctx.params;

    const existing = await prisma.nasRouter.findUnique({ where: { id } });
    if (!existing) throw new Error("Router NAS tidak ditemukan.");

    const activeSessions = await prisma.session.findMany({
      where: { nasId: id, stoppedAt: null },
      select: { id: true },
    });
    if (activeSessions.length > 0) {
      throw new Error(
        `Router tidak dapat dihapus karena masih memiliki ${activeSessions.length} sesi aktif. Putuskan koneksi terlebih dahulu.`,
      );
    }

    await prisma.nasRouter.delete({ where: { id } });
    return NextResponse.json({ success: true });
  },
);
