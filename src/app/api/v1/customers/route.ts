import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { syncCustomerRadius } from "@/lib/radsync";

interface CustomersQuery {
  search?: string;
  status?: string;
  profile?: string;
  page?: number;
  limit?: number;
}

export const GET = asyncApi(async (req: Request) => {
  await requirePermission("customer.read");
  const url = new URL(req.url);
  const q: CustomersQuery = {
    search: url.searchParams.get("search") || undefined,
    status: url.searchParams.get("status") || undefined,
    profile: url.searchParams.get("profile") || undefined,
    page: parseInt(url.searchParams.get("page") || "1", 10),
    limit: parseInt(url.searchParams.get("limit") || "10", 10),
  };

  const safeLimit = Math.min(Math.max(q.limit || 10, 1), 50);
  const safePage = Math.max(q.page || 1, 1);

  const where: Record<string, unknown> = {};
  if (q.search) {
    where.OR = [
      { username: { contains: q.search, mode: "insensitive" } },
      { fullName: { contains: q.search, mode: "insensitive" } },
      { email: { contains: q.search, mode: "insensitive" } },
      { phone: { contains: q.search, mode: "insensitive" } },
    ];
  }
  if (q.status && q.status !== "all") where.status = q.status;
  if (q.profile && q.profile !== "all") where.profileId = q.profile;

  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
  ]);

  const data = rows.map((c) => ({
    ...c,
    lastSeenAt: c.lastSeenAt ? c.lastSeenAt.toISOString() : undefined,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    currentSessionId: c.currentSessionId ?? undefined,
  }));
  return NextResponse.json({ data, total });
});

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("customer.create");
  const body = (await req.json()) as {
    username?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    address?: string;
    status?: string;
    profileId?: string | null;
    staticIp?: string;
    nasId?: string | null;
    bindOnNas?: boolean;
    password?: string;
  };

  const username = body.username?.trim();
  if (!username) throw new Error("Username PPPoE tidak boleh kosong.");

  const dup = await prisma.customer.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
  });
  if (dup) throw new Error(`Username PPPoE '${username}' sudah terdaftar.`);

  const customer = await prisma.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        id: `cust-${Date.now()}`,
        username,
        password: body.password || undefined,
        fullName: body.fullName?.trim() || undefined,
        email: body.email?.trim() || undefined,
        phone: body.phone?.trim() || undefined,
        address: body.address,
        status: body.status ?? "active",
        profileId: body.profileId ?? undefined,
        staticIp: body.staticIp?.trim() || undefined,
        nasId: body.nasId ?? undefined,
        bindOnNas: body.bindOnNas ?? false,
      },
    });
    // radsync — tulis radcheck/radreply (dibaca FreeRADIUS) atomik
    const profile = created.profileId
      ? await tx.bandwidthProfile.findUnique({
          where: { id: created.profileId },
          select: {
            rateLimitDown: true,
            rateLimitUp: true,
            burstLimitDown: true,
            burstLimitUp: true,
            burstThresholdDown: true,
            burstThresholdUp: true,
            burstTimeSeconds: true,
            priority: true,
            limitAtDown: true,
            limitAtUp: true,
          },
        })
      : null;
    const router = created.nasId
      ? await tx.nasRouter.findUnique({
          where: { id: created.nasId },
          select: { ipAddress: true },
        })
      : null;
    await syncCustomerRadius(
      tx,
      created,
      profile,
      body.password ?? undefined,
      router?.ipAddress,
    );
    return created;
  });
  return NextResponse.json({ data: customer }, { status: 201 });
});
