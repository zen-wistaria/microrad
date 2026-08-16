import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json({ data: rows, total });
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
    password?: string;
  };

  const username = body.username?.trim();
  if (!username) throw new Error("Username PPPoE tidak boleh kosong.");

  const dup = await prisma.customer.findFirst({
    where: { username: { equals: username, mode: "insensitive" } },
  });
  if (dup) throw new Error(`Username PPPoE '${username}' sudah terdaftar.`);

  const customer = await prisma.customer.create({
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
    },
  });
  return NextResponse.json({ data: customer }, { status: 201 });
});
