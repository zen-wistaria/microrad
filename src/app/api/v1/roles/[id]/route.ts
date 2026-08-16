import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export const GET = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("setting.read");
  const { id } = await ctx.params;
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new Error("Role tidak ditemukan.");
  return NextResponse.json({ data: role });
});

export const PUT = asyncApi(async (req: Request, ctx: { params: Params }) => {
  // Kelola role = admin-only
  await requirePermission("setting.update");
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    name?: string;
    description?: string;
    permissions?: string[];
  };

  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) throw new Error("Role tidak ditemukan.");
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) throw new Error("Nama role tidak boleh kosong.");
  }

  const role = await prisma.role.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined
        ? { description: body.description.trim() || undefined }
        : {}),
      ...(body.permissions !== undefined
        ? { permissions: body.permissions }
        : {}),
    },
  });
  return NextResponse.json({ data: role });
});

export const DELETE = asyncApi(
  async (_req: Request, ctx: { params: Params }) => {
    // Kelola role = admin-only
    await requirePermission("setting.update");
    const { id } = await ctx.params;

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) throw new Error("Role tidak ditemukan.");
    if (existing.system) {
      throw new Error(
        "Role bawaan sistem (Admin, Manager, Pelanggan) tidak dapat dihapus.",
      );
    }
    const usedCount = await prisma.appUser.count({ where: { roleId: id } });
    if (usedCount > 0) {
      throw new Error(
        `Role ini masih digunakan oleh ${usedCount} pengguna. Pindahkan atau hapus pengguna tersebut terlebih dahulu.`,
      );
    }

    await prisma.role.delete({ where: { id } });
    return NextResponse.json({ success: true });
  },
);
