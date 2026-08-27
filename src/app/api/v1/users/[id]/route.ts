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
    username?: string;
    email?: string;
    password?: string;
    role?: string;
    roleId?: string;
    status?: string;
  };

  const existing = await prisma.appUser.findUnique({ where: { id } });
  if (!existing) throw new Error("Pengguna aplikasi tidak ditemukan.");

  if (body.email !== undefined) {
    const email = body.email.trim();
    if (!email) throw new Error("Email tidak boleh kosong.");
    const dup = await prisma.appUser.findFirst({
      where: { email, NOT: { id } },
    });
    if (dup) {
      throw new Error(`Email '${email}' sudah digunakan oleh akun lain.`);
    }
  }

  if (body.username !== undefined && body.username.trim() !== "") {
    const username = body.username.trim();
    const dup = await prisma.appUser.findFirst({
      where: { username, NOT: { id } },
    });
    if (dup) {
      throw new Error(`Username '${username}' sudah digunakan oleh akun lain.`);
    }
  }

  let hashedPassword: string | undefined;
  if (body.password !== undefined && body.password.trim() !== "") {
    const pwd = body.password.trim();
    if (pwd.length < 6) {
      throw new Error("Password minimal 6 karakter.");
    }
    const { hashPassword } = await import("@better-auth/utils/password");
    hashedPassword = await hashPassword(pwd);
  }

  const targetEmail =
    body.email !== undefined ? body.email.trim() : existing.email;

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.appUser.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.username !== undefined
          ? { username: body.username.trim() || null }
          : {}),
        ...(body.email !== undefined ? { email: targetEmail } : {}),
        ...(body.role !== undefined
          ? { role: body.role === "admin" ? "admin" : "operator" }
          : {}),
        ...(body.roleId !== undefined ? { roleId: body.roleId } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
    });

    // Jika status diubah menjadi disabled, batalkan/hapus seluruh sesi login user yang sedang aktif
    if (updated.status === "disabled") {
      await tx.appSession.deleteMany({
        where: { userId: id },
      });
    }

    if (hashedPassword) {
      const existingAccount = await tx.appAccount.findFirst({
        where: { userId: id, providerId: "credential" },
      });
      if (existingAccount) {
        await tx.appAccount.update({
          where: { id: existingAccount.id },
          data: {
            accountId: targetEmail,
            password: hashedPassword,
          },
        });
      } else {
        await tx.appAccount.create({
          data: {
            id: `acc-${id}-credential`,
            userId: id,
            accountId: targetEmail,
            providerId: "credential",
            password: hashedPassword,
          },
        });
      }
    } else if (
      body.email !== undefined &&
      body.email.trim() !== existing.email
    ) {
      await tx.appAccount.updateMany({
        where: { userId: id, providerId: "credential" },
        data: { accountId: targetEmail },
      });
    }

    return updated;
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
