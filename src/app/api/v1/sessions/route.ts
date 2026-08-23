import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  getOnlineRadacct,
  getRadacctHistory,
  radacctHistoryRowToSession,
  radacctRowToSession,
} from "@/lib/radacct-sessions";

interface SessionsQuery {
  search?: string;
  router?: string; // nilai = IP address router
  activeOnly?: boolean;
  customerId?: string;
  year?: number;
  month?: number;
  page?: number;
  limit?: number;
}

export const GET = asyncApi(async (req: Request) => {
  await requirePermission("session.read");
  const url = new URL(req.url);
  const q: SessionsQuery = {
    search: url.searchParams.get("search") || undefined,
    router: url.searchParams.get("router") || undefined,
    activeOnly: url.searchParams.get("activeOnly") === "true",
    customerId: url.searchParams.get("customerId") || undefined,
    year: url.searchParams.get("year")
      ? parseInt(url.searchParams.get("year") as string, 10)
      : undefined,
    month: url.searchParams.get("month")
      ? parseInt(url.searchParams.get("month") as string, 10)
      : undefined,
    page: parseInt(url.searchParams.get("page") || "1", 10),
    limit: parseInt(url.searchParams.get("limit") || "10", 10),
  };

  const safeLimit = Math.min(Math.max(q.limit || 10, 1), 50);
  const safePage = Math.max(q.page || 1, 1);

  // Bersihkan sesi zombie yang tidak aktif (> 3 menit tanpa update)
  const { cleanupZombieSessions } = await import("@/lib/radacct-cleanup");
  await cleanupZombieSessions(3);

  // SUMBER: radacct langsung — online selalu akurat dari FreeRADIUS.
  // Mode: activeOnly=true → sesi online; else (atau year/month diberikan)
  // → HISTORY sesi (termasuk selesai), filter rentang bulan/tahun.
  const params: {
    nasIpAddress?: string;
    username?: string;
    since?: Date;
    until?: Date;
    limit?: number;
  } = {};
  if (q.router && q.router !== "all") params.nasIpAddress = q.router;
  if (q.customerId) {
    const cust = await prisma.customer.findUnique({
      where: { id: q.customerId },
      select: { username: true },
    });
    if (cust) params.username = cust.username;
  }

  const isHistory = !q.activeOnly || q.year !== undefined;
  let raw: Awaited<ReturnType<typeof getOnlineRadacct>> = [];
  if (isHistory) {
    const year = q.year ?? new Date().getFullYear();
    const month = q.month ?? 0; // 0 = seluruh tahun
    params.since = new Date(Date.UTC(year, month === 0 ? 0 : month - 1, 1));
    params.until = new Date(Date.UTC(year, month === 0 ? 12 : month, 1));
    raw = await getRadacctHistory(params);
  } else {
    raw = await getOnlineRadacct(params);
  }

  // Resolve username → customerId (batch) agar link detail valid
  const usernames = Array.from(
    new Set(raw.map((r) => r.username).filter((u): u is string => Boolean(u))),
  );
  const customers = usernames.length
    ? await prisma.customer.findMany({
        where: { username: { in: usernames } },
        select: { id: true, username: true, nasId: true },
      })
    : [];
  const custByUsername = new Map(customers.map((c) => [c.username, c]));

  let rows = raw.map((r) => {
    const row = isHistory
      ? radacctHistoryRowToSession(r)
      : radacctRowToSession(r);
    const cust = r.username ? custByUsername.get(r.username) : undefined;
    return {
      ...row,
      customerId: cust?.id ?? null,
      nasId: cust?.nasId ?? row.nasId,
    };
  });
  if (q.search) {
    const needle = q.search.toLowerCase();
    rows = rows.filter((s) =>
      [s.customerUsername, s.framedIp ?? "", s.nasIpAddress]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }

  const total = rows.length;
  const pageRows = rows.slice(
    (safePage - 1) * safeLimit,
    (safePage - 1) * safeLimit + safeLimit,
  );

  return NextResponse.json({
    data: pageRows,
    total,
  });
});
