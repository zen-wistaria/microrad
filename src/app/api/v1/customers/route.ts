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
  if (q.group && q.group !== "all") where.areaGroupId = q.group;

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
        areaGroup: {
          include: {
            routers: true,
            pppProfiles: true,
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
    profileGroupId: c.areaGroupId,
    profileGroup: c.areaGroup,
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

  const existingSuffixes = new Set<number>();
  for (const c of [...custMatches, ...radMatches]) {
    const suffixStr = c.username.slice(datePrefix.length);
    if (/^\d{3,4}$/.test(suffixStr)) {
      existingSuffixes.add(parseInt(suffixStr, 10));
    }
  }

  let nextNum = 1;
  while (existingSuffixes.has(nextNum)) {
    nextNum++;
  }
  return `${datePrefix}${String(nextNum).padStart(3, "0")}`;
}

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("customer.create");
  const body = await req.json();

  let username = typeof body.username === "string" ? body.username.trim() : "";
  if (!username) {
    username = await generateServerUniquePppoeUsername();
  }

  // 1. Validasi keunikan username di DB App & FreeRADIUS radcheck
  const [dupCustomer, dupRadcheck] = await Promise.all([
    prisma.customer.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    }),
    prisma.radCheck.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    }),
  ]);

  if (dupCustomer || dupRadcheck) {
    throw new Error(`Username PPPoE '${username}' sudah digunakan.`);
  }

  // 2. Password PPPoE: auto-generate jika kosong
  let password = typeof body.password === "string" ? body.password.trim() : "";
  if (!password) {
    const { generatePppoePassword } = await import("@/lib/generators");
    password = generatePppoePassword();
  }

  // 3. Email (Portal Pelanggan): opsional, jika ada harus unik
  const email =
    typeof body.email === "string" ? body.email.trim() || null : null;
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

  const areaGroupId =
    typeof body.areaGroupId === "string" && body.areaGroupId.trim()
      ? body.areaGroupId.trim()
      : typeof body.profileGroupId === "string" && body.profileGroupId.trim()
        ? body.profileGroupId.trim()
        : null;

  const customer = await prisma.$transaction(async (tx) => {
    const customerId = username;

    // Ambil Internet Profile & Area Group
    const internetProf = body.profileId
      ? await tx.internetProfile.findUnique({
          where: { id: body.profileId },
          include: { bandwidth: true },
        })
      : null;

    const areaGroup = areaGroupId
      ? await tx.areaGroup.findUnique({
          where: { id: areaGroupId },
          include: {
            routers: true,
            pppProfiles: true,
          },
        })
      : null;

    const groupNasIps = (areaGroup?.routers ?? [])
      .map((r) => r.ipAddress)
      .filter((ip): ip is string => Boolean(ip));

    const nasId = areaGroup?.routers[0]?.id ?? body.nasId ?? undefined;
    const nasIp = groupNasIps[0];
    const allowedNasIps = body.bindOnNas ? groupNasIps : [];

    const created = await tx.customer.create({
      data: {
        id: customerId,
        username,
        password,
        fullName:
          typeof body.fullName === "string"
            ? body.fullName.trim() || null
            : null,
        email: email || null,
        phone:
          typeof body.phone === "string" ? body.phone.trim() || null : null,
        address:
          typeof body.address === "string" ? body.address.trim() || null : null,
        status: body.status ?? "active",
        profileId: body.profileId ?? null,
        areaGroupId,
        staticIp:
          typeof body.staticIp === "string"
            ? body.staticIp.trim() || null
            : null,
        nasId: nasId ?? null,
        bindOnNas: body.bindOnNas ?? false,
        sessionMode: body.sessionMode || "single",
        maxSimultaneous: Number(body.maxSimultaneous) || 1,
        allowedNasIps,
      },
    });

    // Buat akun Portal Pelanggan terhubung ke Customer
    let portalPassword =
      typeof body.portalPassword === "string" ? body.portalPassword.trim() : "";
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
      areaGroup?.pppProfiles.find((p) => p.ipModule === "sql") ??
      areaGroup?.pppProfiles[0];
    const poolName = sqlNode?.ipModule === "sql" ? sqlNode.name : null;

    await syncCustomerRadius(
      tx,
      { ...created, poolName },
      internetProf
        ? {
            name: internetProf.name,
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
