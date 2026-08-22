import { NextResponse } from "next/server";
import { asyncApi, requireSession } from "@/lib/api-auth";
import { ensureSyncRuns } from "@/lib/mikrotik-sync";
import { prisma } from "@/lib/prisma";
import {
  getTodayTrafficFromRadacct,
  getUsageTrendFromRadacct,
} from "@/lib/usage-real";

/** Dashboard stats — kontrak: totalCustomers, status, online, traffic hari ini, trend 7 hari */
export const GET = asyncApi(async () => {
  await requireSession();
  ensureSyncRuns();

  const [
    totalCustomers,
    activeCustomers,
    suspendedCustomers,
    totalRoutersOnline,
    totalRoutersOffline,
    onlineNow,
    todayTraffic,
    usageTrend,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { status: "active" } }),
    prisma.customer.count({ where: { status: "suspended" } }),
    prisma.nasRouter.count({ where: { status: "online" } }),
    prisma.nasRouter.count({ where: { status: "offline" } }),
    prisma.radAcct.count({ where: { acctStopTime: null } }),
    getTodayTrafficFromRadacct(prisma),
    getUsageTrendFromRadacct(prisma),
  ]);

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
