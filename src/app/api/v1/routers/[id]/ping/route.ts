import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { connectRouterOS } from "@/lib/mikrotik-client";
import { pingRouterHost } from "@/lib/ping";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

/**
 * Ping nyata ke router (ICMP / TCP reachability).
 * Status online/offline didapat dari ping tanpa memerlukan kredensial API.
 * Jika kredensial tersedia, akan otomatis membaca identity RouterOS jika memungkinkan.
 */
export const POST = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("router.read");
  const { id } = await ctx.params;
  const router = await prisma.nasRouter.findUnique({ where: { id } });
  if (!router) throw new Error("Router tidak ditemukan.");

  const now = new Date();
  const ping = await pingRouterHost(router.ipAddress, router.apiPort || 8728);

  if (!ping.alive) {
    await prisma.nasRouter.update({
      where: { id },
      data: { status: "offline", lastSeenAt: now },
    });
    return NextResponse.json({
      data: {
        status: "offline",
        latencyMs: ping.latencyMs,
        message: ping.error || "Host tidak terjangkau (ping timeout)",
      },
    });
  }

  // Router online! Cek apakah kita bisa mengambil identity RouterOS jika kredensial diisi
  let identity: string | undefined;
  if (router.apiUsername) {
    try {
      const mikrotik = await connectRouterOS(router, 2000);
      try {
        const rows = await mikrotik.write("/system/identity/print");
        identity = rows[0]?.name;
      } finally {
        mikrotik.close();
      }
    } catch {
      // Gagal baca identity karena password salah / port API ditutup, tapi router tetap online via ping
    }
  }

  await prisma.nasRouter.update({
    where: { id },
    data: { status: "online", lastSeenAt: now, lastSyncedAt: now },
  });

  return NextResponse.json({
    data: {
      status: "online",
      latencyMs: ping.latencyMs,
      identity: identity ?? router.name,
      method: ping.method,
    },
  });
});
