import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/** Status FreeRADIUS + statistik RADIUS — untuk halaman Pengaturan. */
export const GET = asyncApi(async () => {
  await requirePermission("setting.read");
  const freeradiusIp = process.env.FREERADIUS_IP ?? "172.30.0.3";
  const [
    radacctCount,
    radpostauthCount,
    radcheckCount,
    nasCount,
    lastAuth,
    lastAcctStop,
    onlineSessions,
  ] = await Promise.all([
    prisma.radAcct.count(),
    prisma.radPostAuth.count(),
    prisma.radCheck.count(),
    prisma.nas.count(),
    prisma.radPostAuth.findFirst({
      orderBy: { authDate: "desc" },
      select: { authDate: true },
    }),
    prisma.radAcct.findFirst({
      orderBy: { acctStopTime: "desc" },
      select: { acctStopTime: true },
    }),
    prisma.radAcct.count({ where: { acctStopTime: null } }),
  ]);
  return NextResponse.json({
    data: {
      enabled: Boolean(process.env.FREERADIUS_IP),
      freeradiusIp,
      radacctCount,
      radpostauthCount,
      radcheckCount,
      nasCount,
      lastAuthAt: lastAuth?.authDate ?? null,
      lastAcctStopAt: lastAcctStop?.acctStopTime ?? null,
      onlineSessions,
    },
  });
});

/** Reload FreeRADIUS (SIGHUP) — nas read_clients baru langsung aktif. */
export const POST = asyncApi(async () => {
  await requirePermission("router.update");
  const { triggerRadiusReload } = await import("@/lib/radius-router");
  const ok = await triggerRadiusReload();
  return NextResponse.json({
    data: {
      success: ok,
      message: ok
        ? "FreeRADIUS dimuat ulang."
        : "FreeRADIUS tidak bisa dimuat ulang (container tidak berjalan?).",
    },
  });
});
