import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { syncCustomerRadius } from "@/lib/radsync";

interface CustomersQuery {
  search?: string;
  status?: string;
  profile?: string;
  group?: string;
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
    group: url.searchParams.get("group") || undefined,
    page: parseInt(url.searchParams.get("page") || "1", 10),
    limit: parseInt(url.searchParams.get("limit") || "10", 10),
  };

  const safeLimit = Math.min(Math.max(q.limit || 10, 1), 50);
  const safePage = Math.max(q.page || 1, 1);

  // Bersihkan sesi zombie radacct agar flag isOnline akurat
  const { cleanupZombieSessions } = await import("@/lib/radacct-cleanup");
  await cleanupZombieSessions(3);

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
  if (q.group && q.group !== "all") where.profileGroupId = q.group;

  const [total, rows] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      include: {
        profile: {
          include: {
            bandwidth: true,
          },
        },
        profileGroup: {
          include: {
            pppProfiles: {
              include: {
                nasRouter: true,
              },
            },
          },
        },
        router: true,
      },
    }),
  ]);

  const usernames = rows.map((c) => c.username);
  const activeRadacct = usernames.length
    ? await prisma.radAcct.findMany({
        where: {
          username: { in: usernames },
          acctStopTime: null,
        },
        select: { username: true },
      })
    : [];
  const onlineUsernames = new Set(activeRadacct.map((r) => r.username));

  const data = rows.map((c) => ({
    ...c,
    isOnline: onlineUsernames.has(c.username),
    lastSeenAt: c.lastSeenAt ? c.lastSeenAt.toISOString() : undefined,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));
  return NextResponse.json({ data, total });
});

async function generateServerUniquePppoeUsername(
  prefix = "cust_",
): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const datePrefix = `${prefix}${yyyy}${mm}${dd}`;

  // Cari seluruh username yang cocok dengan datePrefix hari ini
  const [custMatches, radMatches] = await Promise.all([
    prisma.customer.findMany({
      where: {
        username: { startsWith: datePrefix, mode: "insensitive" },
      },
      select: { username: true },
    }),
    prisma.radCheck.findMany({
      where: {
        username: { startsWith: datePrefix, mode: "insensitive" },
      },
      select: { username: true },
    }),
  ]);

  const existingNums = new Set<number>();
  for (const c of [...custMatches, ...radMatches]) {
    const seqPart = c.username.slice(datePrefix.length);
    const num = parseInt(seqPart, 10);
    if (!Number.isNaN(num)) {
      existingNums.add(num);
    }
  }

  let seq = 1;
  while (existingNums.has(seq)) {
    seq++;
  }

  return `${datePrefix}${String(seq).padStart(4, "0")}`;
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
    profileGroupId?: string | null;
    staticIp?: string;
    nasId?: string | null;
    bindOnNas?: boolean;
    sessionMode?: "single" | "multi" | string;
    maxSimultaneous?: number;
    allowedNasIps?: string[];
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
    const customerId = username;

    // Ambil Internet Profile & Profile Group
    const internetProf = body.profileId
      ? await tx.internetProfile.findUnique({
          where: { id: body.profileId },
          include: { bandwidth: true },
        })
      : null;

    const profileGroup = body.profileGroupId
      ? await tx.profileGroup.findUnique({
          where: { id: body.profileGroupId },
          include: {
            pppProfiles: {
              include: { nasRouter: true },
            },
          },
        })
      : null;

    const groupNasIps = (profileGroup?.pppProfiles ?? [])
      .map((p) => p.nasRouter?.ipAddress)
      .filter((ip): ip is string => Boolean(ip));

    const nasId =
      profileGroup?.pppProfiles[0]?.nasId ?? body.nasId ?? undefined;
    const nasIp = groupNasIps[0];
    const allowedNasIps = body.bindOnNas ? groupNasIps : [];

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
        profileGroupId: body.profileGroupId ?? undefined,
        staticIp: body.staticIp?.trim() || undefined,
        nasId,
        bindOnNas: body.bindOnNas ?? false,
        sessionMode: body.sessionMode || "single",
        maxSimultaneous: Number(body.maxSimultaneous) || 1,
        allowedNasIps,
      },
    });

    // Buat akun Portal Pelanggan terhubung ke Customer
    let portalPassword = body.portalPassword?.trim();
    if (!portalPassword) {
      const { generatePppoePassword } = await import("@/lib/generators");
      portalPassword = generatePppoePassword(8);
    }
    const { hashPassword } = await import("@better-auth/utils/password");
    const hashedPassword = await hashPassword(portalPassword);
    const portalUserId = `usr-${customerId}`;

    await tx.portalUser.create({
      data: {
        id: portalUserId,
        name: created.fullName || created.username,
        username: created.username,
        email: email || undefined,
        customerId: created.id,
        accounts: {
          create: {
            id: `pacc-${portalUserId}-credential`,
            accountId: email || created.username,
            providerId: "credential",
            password: hashedPassword,
          },
        },
      },
    });

    // radsync — tulis radcheck/radreply (dibaca FreeRADIUS) atomik
    const sqlNode =
      profileGroup?.pppProfiles.find((p) => p.ipModule === "sql") ??
      profileGroup?.pppProfiles[0];
    const poolName = sqlNode?.ipModule === "sql" ? sqlNode.name : null;

    await syncCustomerRadius(
      tx,
      { ...created, poolName },
      internetProf
        ? {
            bandwidth: internetProf.bandwidth,
            priority: internetProf.priority,
            dnsServers: sqlNode?.dnsServers,
            poolName,
          }
        : null,
      password,
      nasIp,
    );
    return created;
  });

  return NextResponse.json({ data: customer }, { status: 201 });
});
