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
      { username: { contains: q.search, mode: "insensitive" } },
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
    username?: string;
    email?: string;
    password?: string;
    role?: string;
    roleId?: string;
    status?: string;
  };

  const name = body.name?.trim();
  const username = body.username?.trim() || null;
  const email = body.email?.trim();
  const password = body.password?.trim();

  if (!name) throw new Error("Nama pengguna tidak boleh kosong.");
  if (!email) throw new Error("Email tidak boleh kosong.");
  if (!password) {
    throw new Error("Kata sandi (password) wajib diisi untuk pengguna baru.");
  }
  if (password.length < 6) {
    throw new Error("Password minimal 6 karakter.");
  }

  const existingEmail = await prisma.appUser.findUnique({ where: { email } });
  if (existingEmail) {
    throw new Error(`Email '${email}' sudah terdaftar untuk pengguna lain.`);
  }

  if (username) {
    const existingUsername = await prisma.appUser.findFirst({
      where: { username },
    });
    if (existingUsername) {
      throw new Error(
        `Username '${username}' sudah terdaftar untuk pengguna lain.`,
      );
    }
  }

  const { hashPassword } = await import("@better-auth/utils/password");
  const hashedPassword = await hashPassword(password);
  const userId = `usr-${Date.now()}`;

  const user = await prisma.appUser.create({
    data: {
      id: userId,
      name,
      username,
      email,
      role: body.role === "admin" ? "admin" : "operator",
      roleId:
        body.roleId ?? (body.role === "admin" ? "role-admin" : "role-manager"),
      status: body.status ?? "active",
      accounts: {
        create: {
          id: `acc-${userId}-credential`,
          accountId: email,
          providerId: "credential",
          password: hashedPassword,
        },
      },
    },
  });

  return NextResponse.json({ data: user }, { status: 201 });
});
