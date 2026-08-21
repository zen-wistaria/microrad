import { NextResponse } from "next/server";
import { asyncApi, requireSession } from "@/lib/api-auth";
import { ensureSyncRuns } from "@/lib/mikrotik-sync";
import { prisma } from "@/lib/prisma";
import { getOnlineRadacct } from "@/lib/radacct-sessions";
import { getUsageTrendFromRadacct } from "@/lib/usage-real";

/** Dashboard stats — kontrak: totalCustomers, status, online, traffic hari ini, trend 7 hari */
export const GET = asyncApi(async () => {
  await requireSession();
  await ensureSyncRuns();

  const [customers, routers, onlineAcct] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, status: true } }),
    prisma.nasRouter.findMany({ select: { id: true, status: true } }),
    getOnlineRadacct({ limit: 500 }),
  ]);

  const sessions = onlineAcct.map((r) => {
    const nowMs = Date.now();
    const baseMs = Number(r.acctSessionTime ?? 0) * 1000;
    const sinceUpdateMs = r.acctUpdateTime
      ? Math.max(0, nowMs - new Date(r.acctUpdateTime).getTime())
      : 0;
    const duration = Math.max(0, Math.round((baseMs + sinceUpdateMs) / 1000));
    const growth = 1 + Math.min(duration * 10, 3600) / 3600;
    return {
      startedAt: r.acctStartTime ?? new Date(),
      stoppedAt: null,
      inputBytes: Number(r.acctInputOctets ?? 0) * growth,
      outputBytes: Number(r.acctOutputOctets ?? 0) * growth,
    };
  });

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.status === "active").length;
  const suspendedCustomers = customers.filter(
    (c) => c.status === "suspended",
  ).length;

  const onlineNow = sessions.filter((s) => !s.stoppedAt).length;
  const totalRoutersOnline = routers.filter(
    (r) => r.status === "online",
  ).length;
  const totalRoutersOffline = routers.filter(
    (r) => r.status === "offline",
  ).length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaySessions = sessions.filter(
    (s) => !s.stoppedAt || s.startedAt >= todayStart,
  );

  let totalDownload = 0;
  let totalUpload = 0;
  for (const s of todaySessions) {
    const growth = s.stoppedAt
      ? 1
      : 1 +
        Math.min(
          Math.max(0, (Date.now() - s.startedAt.getTime()) / 1000) * 10,
          3600,
        ) /
          3600;
    totalDownload += Number(s.outputBytes) * growth;
    totalUpload += Number(s.inputBytes) * growth;
  }

  // Tanpa fallback synthetic — data nyata apa adanya (akun baru = 0)

  const usageTrend = await getUsageTrendFromRadacct(prisma);

  return NextResponse.json({
    data: {
      totalCustomers,
      activeCustomers,
      suspendedCustomers,
      onlineNow,
      totalRoutersOnline,
      totalRoutersOffline,
      totalTrafficTodayBytes: Math.round(totalDownload + totalUpload),
      totalDownloadTodayBytes: Math.round(totalDownload),
      totalUploadTodayBytes: Math.round(totalUpload),
      usageTrend,
    },
  });
});
