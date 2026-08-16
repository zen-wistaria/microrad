import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { connectRouterOS } from "@/lib/mikrotik-client";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

/** Ping nyata ke RouterOS API (latency round-trip + identity). */
export const POST = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("router.read");
  const { id } = await ctx.params;
  const router = await prisma.nasRouter.findUnique({ where: { id } });
  if (!router) throw new Error("Router tidak ditemukan.");

  if (!router.apiUsername) {
    return NextResponse.json({
      data: {
        status: "offline",
        latencyMs: 0,
        reason: "no-credentials",
        message:
          "Kredensial API RouterOS belum diisi — lengkapi lalu simpan router.",
      },
    });
  }

  const t0 = Date.now();
  try {
    const mikrotik = await connectRouterOS(router);
    try {
      const rows = await mikrotik.write("/system/identity/print");
      const latencyMs = Date.now() - t0;
      const identity = rows[0]?.["=name"] ?? router.name;
      await prisma.nasRouter.update({
        where: { id },
        data: { status: "online", lastSeenAt: new Date() },
      });
      return NextResponse.json({
        data: { status: "online", latencyMs, identity },
      });
    } finally {
      mikrotik.close();
    }
  } catch {
    await prisma.nasRouter.update({
      where: { id },
      data: { status: "offline", lastSeenAt: new Date() },
    });
    return NextResponse.json({
      data: { status: "offline", latencyMs: Date.now() - t0 },
    });
  }
});
