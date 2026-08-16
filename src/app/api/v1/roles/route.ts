import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const GET = asyncApi(async () => {
  await requirePermission("setting.read");
  const roles = await prisma.role.findMany({
    orderBy: [{ system: "desc" }, { name: "asc" }],
  });
  return NextResponse.json({ data: roles });
});

export const POST = asyncApi(async (req: Request) => {
  // Kelola role = admin-only
  await requirePermission("setting.update");
  const body = (await req.json()) as {
    name?: string;
    description?: string;
    permissions?: string[];
  };
  const name = body.name?.trim();
  if (!name) throw new Error("Nama role tidak boleh kosong.");
  const role = await prisma.role.create({
    data: {
      id: `role-${Date.now()}`,
      name,
      description: body.description?.trim() || undefined,
      permissions: body.permissions ?? [],
      system: false,
    },
  });
  return NextResponse.json({ data: role }, { status: 201 });
});
