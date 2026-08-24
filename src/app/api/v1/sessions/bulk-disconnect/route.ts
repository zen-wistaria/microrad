import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { kickSessionByUsername } from "@/lib/mikrotik-disconnect";
import { prisma } from "@/lib/prisma";
import { sendDisconnect } from "@/lib/radius-coa";

interface BulkDisconnectBody {
  sessionIds: string[];
}

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("session.update");
  const body = (await req.json()) as BulkDisconnectBody;
  const { sessionIds } = body;

  if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
    throw new Error("Daftar sesi wajib disertakan.");
  }

  const rawUniqueIds = sessionIds.map((id) =>
    id.startsWith("acct-") ? id.slice(5) : id,
  );

  const sessions = await prisma.radAcct.findMany({
    where: {
      acctUniqueId: { in: rawUniqueIds },
      acctStopTime: null,
    },
  });

  if (sessions.length === 0) {
    return NextResponse.json({
      success: true,
      message: "Tidak ada sesi aktif yang ditemukan.",
      count: 0,
    });
  }

  const usernames = sessions
    .map((s) => s.username)
    .filter((u): u is string => Boolean(u));

  const customers = await prisma.customer.findMany({
    where: { username: { in: usernames } },
    select: { username: true, nasId: true },
  });
  const customerMap = new Map(customers.map((c) => [c.username, c]));

  let disconnectedCount = 0;
  for (const sess of sessions) {
    if (!sess.username) continue;
    const cust = customerMap.get(sess.username);

    const coaResult = await sendDisconnect(sess.username, {
      acctSessionId: sess.acctSessionId ?? undefined,
      nasIp: sess.nasIpAddress ?? undefined,
      framedIp: sess.framedIpAddress ?? undefined,
    });

    if (!coaResult.success) {
      await kickSessionByUsername(sess.username, cust?.nasId ?? null);
    }
    disconnectedCount++;
  }

  return NextResponse.json({
    success: true,
    message: `${disconnectedCount} sesi aktif berhasil diputuskan.`,
    count: disconnectedCount,
  });
});
