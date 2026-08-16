import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export const GET = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("user.read");
  const { id } = await ctx.params;
  const user = await prisma.appUser.findUnique({ where: { id } });
  if (!user) throw new Error("Pengguna aplikasi tidak ditemukan.");
  return NextResponse.json({ data: user });
});

export const PUT = asyncApi(async (req: Request, ctx: { params: Params }) => {
  await requirePermission("user.update");
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    name?: string;
    email?: string;
    role?: string;
    roleId?: string;
    status?: string;
  };

  const existing = await prisma.appUser.findUnique({ where: { id } });
  if (!existing) throw new Error("Pengguna aplikasi tidak ditemukan.");

  if (body.email !== undefined) {
    const email = body.email.trim();
    const dup = await prisma.appUser.findFirst({
      where: { email, NOT: { id } },
    });
    if (dup)
      throw new Error(`Email '${email}' sudah digunakan oleh akun lain.`);
  }

  const user = await prisma.appUser.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.email !== undefined ? { email: body.email.trim() } : {}),
      ...(body.role !== undefined
        ? { role: body.role === "admin" ? "admin" : "operator" }
        : {}),
      ...(body.roleId !== undefined ? { roleId: body.roleId } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
    },
  });
  return NextResponse.json({ data: user });
});

export const DELETE = asyncApi(
  async (_req: Request, ctx: { params: Params }) => {
    await requirePermission("user.delete");
    const { id } = await ctx.params;

    const existing = await prisma.appUser.findUnique({ where: { id } });
    if (!existing) throw new Error("Pengguna aplikasi tidak ditemukan.");

    const totalUsers = await prisma.appUser.count();
    if (totalUsers <= 1) {
      throw new Error(
        "Tidak dapat menghapus satu-satunya akun pengguna yang tersisa.",
      );
    }

    await prisma.appUser.delete({ where: { id } });
    return NextResponse.json({ success: true });
  },
);
