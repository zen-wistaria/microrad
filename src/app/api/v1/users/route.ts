import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

interface UsersQuery {
  search?: string;
  status?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export const GET = asyncApi(async (req: Request) => {
  await requirePermission("user.read");
  const url = new URL(req.url);
  const q: UsersQuery = {
    search: url.searchParams.get("search") || undefined,
    status: url.searchParams.get("status") || undefined,
    role: url.searchParams.get("role") || undefined,
    page: parseInt(url.searchParams.get("page") || "1", 10),
    limit: parseInt(url.searchParams.get("limit") || "10", 10),
  };

  const safeLimit = Math.min(Math.max(q.limit || 10, 1), 50);
  const safePage = Math.max(q.page || 1, 1);

  const where: Record<string, unknown> = {};
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: "insensitive" } },
      { email: { contains: q.search, mode: "insensitive" } },
    ];
  }
  if (q.status && q.status !== "all") where.status = q.status;
  if (q.role && q.role !== "all") {
    // Kompatibilitas filter role lama: "manager" → role-manager
    where.roleId =
      q.role === "manager"
        ? "role-manager"
        : q.role === "admin"
          ? "role-admin"
          : q.role;
  }

  const [total, rows] = await Promise.all([
    prisma.appUser.count({ where }),
    prisma.appUser.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
  ]);

  return NextResponse.json({ data: rows, total });
});

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("user.create");
  const body = (await req.json()) as {
    name?: string;
    email?: string;
    role?: string;
    roleId?: string;
    status?: string;
  };

  const name = body.name?.trim();
  const email = body.email?.trim();
  if (!name) throw new Error("Nama pengguna tidak boleh kosong.");
  if (!email) throw new Error("Email tidak boleh kosong.");

  const existing = await prisma.appUser.findUnique({ where: { email } });
  if (existing) {
    throw new Error(`Email '${email}' sudah terdaftar untuk pengguna lain.`);
  }

  const user = await prisma.appUser.create({
    data: {
      id: `usr-${Date.now()}`,
      name,
      email,
      role: body.role === "admin" ? "admin" : "operator",
      roleId:
        body.roleId ?? (body.role === "admin" ? "role-admin" : "role-manager"),
      status: body.status ?? "active",
    },
  });
  return NextResponse.json({ data: user }, { status: 201 });
});
