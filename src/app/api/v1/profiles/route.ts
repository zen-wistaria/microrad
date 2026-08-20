import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const GET = asyncApi(async () => {
  await requirePermission("profile.read");
  const profiles = await prisma.bandwidthProfile.findMany({
    orderBy: { name: "asc" },
  });
  const counts = await prisma.customer.groupBy({
    by: ["profileId"],
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.profileId, c._count._all]));
  const data = profiles.map((p) => ({
    ...p,
    customerCount: countMap.get(p.id) ?? 0,
  }));
  return NextResponse.json({ data });
});

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("profile.create");
  const body = (await req.json()) as {
    name?: string;
    rateLimitDown?: number;
    rateLimitUp?: number;
    burstLimitDown?: number | null;
    burstLimitUp?: number | null;
    burstThresholdDown?: number | null;
    burstThresholdUp?: number | null;
    burstTimeSeconds?: number | null;
    priority?: number | null;
    limitAtDown?: number | null;
    limitAtUp?: number | null;
    price?: number | null;
    description?: string;
  };
  const name = body.name?.trim();
  if (!name) throw new Error("Nama profil bandwidth tidak boleh kosong.");

  const profile = await prisma.bandwidthProfile.create({
    data: {
      id: `prof-${Date.now()}`,
      name,
      rateLimitDown: body.rateLimitDown ?? 0,
      rateLimitUp: body.rateLimitUp ?? 0,
      burstLimitDown: body.burstLimitDown ?? null,
      burstLimitUp: body.burstLimitUp ?? null,
      burstThresholdDown: body.burstThresholdDown ?? null,
      burstThresholdUp: body.burstThresholdUp ?? null,
      burstTimeSeconds: body.burstTimeSeconds ?? null,
      priority: body.priority ?? null,
      limitAtDown: body.limitAtDown ?? null,
      limitAtUp: body.limitAtUp ?? null,
      price: body.price ?? null,
      description: body.description?.trim() || undefined,
    },
  });
  return NextResponse.json(
    { data: { ...profile, customerCount: 0 } },
    { status: 201 },
  );
});
