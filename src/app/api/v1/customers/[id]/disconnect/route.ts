import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

/**
 * POST /api/v1/customers/[id]/disconnect — putus sesi aktif pelanggan.
 * Sesi online dibaca dari radacct; kirim Disconnect-Request (CoA RFC 5176)
 * via FreeRADIUS; fallback RouterOS API bila CoA gagal.
 */
export const POST = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("customer.update");
  const { id } = await ctx.params;

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw new Error("Pelanggan tidak ditemukan.");

  const online = await prisma.radAcct.findMany({
    where: { username: existing.username, acctStopTime: null },
    orderBy: { acctStartTime: "desc" },
    take: 1,
  });
  if (online[0]) {
    // 1) CoA Disconnect-Request via FreeRADIUS (RFC 5176)
    const { sendDisconnect } = await import("@/lib/radius-coa");
    const coaResult = await sendDisconnect(existing.username, {
      acctSessionId: online[0].acctSessionId ?? undefined,
    });

    // 2) Fallback RouterOS API bila CoA gagal/tidak dijawab ACK
    if (!coaResult.success) {
      const { kickSessionByUsername } = await import(
        "@/lib/mikrotik-disconnect"
      );
      await kickSessionByUsername(existing.username, existing.nasId);
    }

    await prisma.customer.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      coa: coaResult.code ?? null,
    });
  }
  return NextResponse.json({ success: true });
});
