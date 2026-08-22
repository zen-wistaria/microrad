import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export const GET = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("profile.read");
  const { id } = await ctx.params;
  const profile = await prisma.pppProfile.findUnique({
    where: { id },
    include: {
      bandwidth: true,
      profileGroup: true,
      _count: {
        select: { customers: true },
      },
    },
  });
  if (!profile) throw new Error("Profil tidak ditemukan.");
  return NextResponse.json({
    data: {
      ...profile,
      customerCount: profile._count.customers,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    },
  });
});
