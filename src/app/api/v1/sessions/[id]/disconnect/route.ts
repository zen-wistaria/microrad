import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

/**
 * POST /api/v1/sessions/[id]/disconnect — putus sesi aktif.
 * id sesi = `acct-<acctUniqueId>` — dicari di radacct, lalu kirim
 * Disconnect-Request (CoA RFC 5176) via FreeRADIUS ke NAS; fallback ke
 * RouterOS API bila CoA gagal.
 */
export const POST = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("session.update");
  const { id } = await ctx.params;
  const acctId = id.startsWith("acct-") ? id.slice(5) : null;
  if (!acctId) {
    throw new Error("Sesi tidak dikenali.");
  }
  const acct = await prisma.radAcct.findUnique({
    where: { acctUniqueId: acctId },
  });
  if (!acct || acct.acctStopTime) {
    throw new Error("Gagal memutuskan sesi PPPoE atau sesi sudah berakhir.");
  }
  const customer = acct.username
    ? await prisma.customer.findUnique({
        where: { username: acct.username },
        select: { nasId: true, username: true },
      })
    : null;
  const username = customer?.username ?? acct.username ?? "";

  // 1) CoA Disconnect-Request (RFC 5176) — best-effort
  const { sendDisconnect } = await import("@/lib/radius-coa");
  const coaResult = await sendDisconnect(username, {
    acctSessionId: acct.acctSessionId ?? undefined,
    nasIp: acct.nasIpAddress ?? undefined,
    framedIp: acct.framedIpAddress ?? undefined,
  });

  // 2) Fallback: RouterOS API bila CoA gagal/tidak dijawab ACK
  if (!coaResult.success) {
    const { kickSessionByUsername } = await import("@/lib/mikrotik-disconnect");
    await kickSessionByUsername(username, customer?.nasId ?? null);
  }

  return NextResponse.json({
    success: true,
    coa: coaResult.code ?? null,
  });
});
