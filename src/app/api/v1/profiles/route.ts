import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const GET = asyncApi(async () => {
  await requirePermission("profile.read");
  const profiles = await prisma.internetProfile.findMany({
    orderBy: { name: "asc" },
    include: {
      bandwidth: true,
      _count: {
        select: { customers: true },
      },
    },
  });

  const data = profiles.map((p) => ({
    ...p,
    customerCount: p._count.customers,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return NextResponse.json({ data });
});
