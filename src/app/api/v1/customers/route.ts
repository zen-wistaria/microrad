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
  }));
  return NextResponse.json({ data, total });
});

async function generateServerUniquePppoeUsername(
  prefix = "user_",
): Promise<string> {
  const { generateCandidateUsername } = await import("@/lib/generators");
  let attempts = 0;
  while (attempts < 30) {
    const candidate = generateCandidateUsername(prefix);
    const [existingCust, existingRad] = await Promise.all([
      prisma.customer.findFirst({
        where: { username: { equals: candidate, mode: "insensitive" } },
        select: { id: true },
      }),
      prisma.radCheck.findFirst({
        where: { username: candidate },
        select: { id: true },
      }),
    ]);

    if (!existingCust && !existingRad) {
      return candidate;
    }
    attempts++;
  }
  return `${prefix}${Date.now().toString().slice(-6)}`;
}

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
    portalPassword?: string;
  };

  // 1. Username PPPoE: auto-generate jika kosong, pastikan unik
  let username = body.username?.trim();
  if (!username) {
    username = await generateServerUniquePppoeUsername();
  }

  const [dupCustomer, dupRad] = await Promise.all([
    prisma.customer.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    }),
    prisma.radCheck.findFirst({
      where: { username },
    }),
  ]);
  if (dupCustomer || dupRad) {
    throw new Error(`Username PPPoE '${username}' sudah terdaftar.`);
  }

  // 2. Password PPPoE: auto-generate jika kosong
  let password = body.password?.trim();
  if (!password) {
    const { generatePppoePassword } = await import("@/lib/generators");
    password = generatePppoePassword();
  }

  // 3. Email (Portal Pelanggan): opsional, jika ada harus unik
  const email = body.email?.trim() || null;
  if (email) {
    const [dupEmailCustomer, dupEmailPortal] = await Promise.all([
      prisma.customer.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
      }),
      prisma.portalUser.findUnique({
        where: { email },
      }),
    ]);
    if (dupEmailCustomer || dupEmailPortal) {
      throw new Error(`Email '${email}' sudah digunakan oleh pelanggan lain.`);
    }
  }

  const customer = await prisma.$transaction(async (tx) => {
    const customerId = `cust-${Date.now()}`;
    const created = await tx.customer.create({
      data: {
        id: customerId,
        username,
        password,
        fullName: body.fullName?.trim() || undefined,
        email: email || undefined,
        phone: body.phone?.trim() || undefined,
        address: body.address,
        status: body.status ?? "active",
        profileId: body.profileId ?? undefined,
        staticIp: body.staticIp?.trim() || undefined,
        nasId: body.nasId ?? undefined,
        bindOnNas: body.bindOnNas ?? false,
      },
    });

    // Buat akun Portal Pelanggan terpisah jika email disertakan
    if (email) {
      const portalPassword = body.portalPassword?.trim() || "password123";
      const { hashPassword } = await import("@better-auth/utils/password");
      const hashedPassword = await hashPassword(portalPassword);
      const portalUserId = `usr-${customerId}`;

      await tx.portalUser.create({
        data: {
          id: portalUserId,
          name: created.fullName || created.username,
          email,
          customerId: created.id,
          accounts: {
            create: {
              id: `pacc-${portalUserId}-credential`,
              accountId: email,
              providerId: "credential",
              password: hashedPassword,
            },
          },
        },
      });
    }

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
    await syncCustomerRadius(tx, created, profile, password, router?.ipAddress);
    return created;
  });

  return NextResponse.json({ data: customer }, { status: 201 });
});
