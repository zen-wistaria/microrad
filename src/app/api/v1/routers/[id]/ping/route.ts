import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { connectRouterOS } from "@/lib/mikrotik-client";
import { pingIcmp } from "@/lib/ping";
import { prisma } from "@/lib/prisma";
import type { NasRouterStatus } from "@/lib/types";

type Params = Promise<{ id: string }>;

/**
 * POST /api/v1/routers/[id]/ping
 * Melakukan pengecekan status router:
 * 1. Ping ICMP Host Reachability
 * 2. Koneksi API RouterOS (Port, Kredensial & Identity)
 *
 * Menghasilkan 4 varian status:
 * - online (Hijau): Ping ICMP OK + API RouterOS OK
 * - online_ping_only (Kuning): Ping ICMP OK + API RouterOS Gagal
 * - online_api_only (Biru): Ping ICMP Gagal + API RouterOS OK
 * - offline (Merah): Ping ICMP Gagal + API RouterOS Gagal
 */
export const POST = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("router.read");
  const { id } = await ctx.params;
  const router = await prisma.nasRouter.findUnique({ where: { id } });
  if (!router) throw new Error("Router tidak ditemukan.");

  const now = new Date();

  // 1. Tes Ping ICMP
  const icmp = await pingIcmp(router.ipAddress, 1500);
  const pingOk = icmp.alive;

  // 2. Tes Koneksi API RouterOS
  let apiOk = false;
  let identity: string | undefined;
  let apiError: string | undefined;

  if (router.apiUsername) {
    try {
      const mikrotik = await connectRouterOS(
        {
          ipAddress: router.ipAddress,
          apiUsername: router.apiUsername,
          apiPassword: router.apiPassword ?? "",
          apiPort: router.apiPort || 8728,
        },
        2500,
      );
      try {
        const rows = await mikrotik.write("/system/identity/print");
        identity = rows[0]?.name || router.name;
        apiOk = true;
      } finally {
        mikrotik.close();
      }
    } catch (err) {
      apiOk = false;
      apiError = err instanceof Error ? err.message : String(err);
    }
  } else {
    apiOk = false;
    apiError = "Kredensial API RouterOS belum dikonfigurasi";
  }

  // 3. Tentukan Status Router
  let status: NasRouterStatus;
  if (pingOk && apiOk) {
    status = "online";
  } else if (pingOk && !apiOk) {
    status = "online_ping_only";
  } else if (!pingOk && apiOk) {
    status = "online_api_only";
  } else {
    status = "offline";
  }

  // 4. Update status ke Database
  await prisma.nasRouter.update({
    where: { id },
    data: {
      status,
      lastSeenAt: now,
      lastSyncedAt: status !== "offline" ? now : undefined,
    },
  });

  return NextResponse.json({
    data: {
      status,
      pingOk,
      apiOk,
      latencyMs: icmp.latencyMs,
      identity: identity ?? router.name,
      apiError,
      pingError: pingOk
        ? undefined
        : `Host tidak merespons ping ICMP (${icmp.latencyMs}ms timeout)`,
    },
  });
});
