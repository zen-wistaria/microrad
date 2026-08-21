import { NextResponse } from "next/server";
import { asyncApi, requireSession } from "@/lib/api-auth";
import { ensureSyncRuns } from "@/lib/mikrotik-sync";
import { prisma } from "@/lib/prisma";
import { getOnlineRadacct } from "@/lib/radacct-sessions";
import {
  getTodayTrafficFromRadacct,
  getUsageTrendFromRadacct,
} from "@/lib/usage-real";

/** Dashboard stats — kontrak: totalCustomers, status, online, traffic hari ini, trend 7 hari */
export const GET = asyncApi(async () => {
  await requireSession();
  await ensureSyncRuns();

  const [customers, routers, onlineAcct, todayTraffic, usageTrend] =
    await Promise.all([
      prisma.customer.findMany({ select: { id: true, status: true } }),
      prisma.nasRouter.findMany({ select: { id: true, status: true } }),
      getOnlineRadacct({ limit: 500 }),
      getTodayTrafficFromRadacct(prisma),
      getUsageTrendFromRadacct(prisma),
    ]);

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.status === "active").length;
  const suspendedCustomers = customers.filter(
    (c) => c.status === "suspended",
  ).length;

  const onlineNow = onlineAcct.length;
  const totalRoutersOnline = routers.filter(
    (r) => r.status === "online",
  ).length;
  const totalRoutersOffline = routers.filter(
    (r) => r.status === "offline",
  ).length;

  return NextResponse.json({
    data: {
      totalCustomers,
      activeCustomers,
      suspendedCustomers,
      onlineNow,
      totalRoutersOnline,
      totalRoutersOffline,
      totalTrafficTodayBytes: todayTraffic.totalTrafficBytes,
      totalDownloadTodayBytes: todayTraffic.totalDownloadBytes,
      totalUploadTodayBytes: todayTraffic.totalUploadBytes,
      usageTrend,
    },
  });
});
