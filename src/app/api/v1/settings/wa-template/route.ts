import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const GET = asyncApi(async () => {
  await requirePermission("setting.read");
  const tpl = await prisma.waTemplate.findUnique({ where: { id: 1 } });
  return NextResponse.json({ data: tpl?.template ?? "" });
});

export const PUT = asyncApi(async (req: Request) => {
  await requirePermission("setting.update");
  const body = (await req.json()) as { template?: string };
  const template = body.template?.trim() ?? "";
  if (!template) throw new Error("Template tidak boleh kosong.");
  const tpl = await prisma.waTemplate.upsert({
    where: { id: 1 },
    update: { template },
    create: { id: 1, template },
  });
  return NextResponse.json({ data: tpl.template });
});
