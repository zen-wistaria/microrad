import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

interface LogsQuery {
  search?: string;
  source?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const GET = asyncApi(async (req: Request) => {
  await requirePermission("log.read");
  const url = new URL(req.url);
  const q: LogsQuery = {
    search: url.searchParams.get("search") || undefined,
    source: url.searchParams.get("source") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    page: parseInt(url.searchParams.get("page") || "1", 10),
    limit: parseInt(url.searchParams.get("limit") || "10", 10),
  };

  const safeLimit = Math.min(Math.max(q.limit || 10, 1), 50);
  const safePage = Math.max(q.page || 1, 1);

  const where: Record<string, unknown> = {};
  if (q.search) {
    where.OR = [
      { userName: { contains: q.search, mode: "insensitive" } },
      { ipAddress: { contains: q.search, mode: "insensitive" } },
      { userAgent: { contains: q.search, mode: "insensitive" } },
    ];
  }
  if (q.source && q.source !== "all") where.source = q.source;
  if (q.from) where.timestamp = { gte: new Date(q.from) };
  if (q.to) {
    const toDate = new Date(q.to);
    toDate.setHours(23, 59, 59, 999); // sampai akhir hari
    where.timestamp = { ...(where.timestamp as object), lte: toDate };
  }

  const [total, rows] = await Promise.all([
    prisma.globalLog.count({ where }),
    prisma.globalLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
  ]);

  const data = rows.map((log) => ({
    ...log,
    timestamp: log.timestamp.toISOString(),
    createdAt: log.createdAt.toISOString(),
  }));
  return NextResponse.json({ data, total });
});
