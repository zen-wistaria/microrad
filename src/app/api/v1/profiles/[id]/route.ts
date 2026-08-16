import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { syncProfileRadius } from "@/lib/radsync";

type Params = Promise<{ id: string }>;

export const GET = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("profile.read");
  const { id } = await ctx.params;
  const profile = await prisma.bandwidthProfile.findUnique({ where: { id } });
  if (!profile) throw new Error("Profil bandwidth tidak ditemukan.");
  const count = await prisma.customer.count({ where: { profileId: id } });
  return NextResponse.json({ data: { ...profile, customerCount: count } });
});

export const PUT = asyncApi(async (req: Request, ctx: { params: Params }) => {
  await requirePermission("profile.update");
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    name?: string;
    rateLimitDown?: number;
    rateLimitUp?: number;
    price?: number | null;
    description?: string;
  };

  const existing = await prisma.bandwidthProfile.findUnique({ where: { id } });
  if (!existing) throw new Error("Profil bandwidth tidak ditemukan.");

  const profile = await prisma.$transaction(async (tx) => {
    const updated = await tx.bandwidthProfile.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.rateLimitDown !== undefined
          ? { rateLimitDown: body.rateLimitDown }
          : {}),
        ...(body.rateLimitUp !== undefined
          ? { rateLimitUp: body.rateLimitUp }
          : {}),
        ...("price" in body ? { price: body.price ?? null } : {}),
        ...(body.description !== undefined
          ? { description: body.description.trim() || undefined }
          : {}),
      },
    });
    // radsync — perbarui Mikrotik-Rate-Limit semua pelanggan profil ini
    if (body.rateLimitDown !== undefined || body.rateLimitUp !== undefined) {
      const customers = await tx.customer.findMany({
        where: { profileId: id },
        select: { username: true },
      });
      await syncProfileRadius(
        tx,
        updated,
        customers.map((c) => c.username),
      );
    }
    return updated;
  });
  const count = await prisma.customer.count({ where: { profileId: id } });
  return NextResponse.json({ data: { ...profile, customerCount: count } });
});

export const DELETE = asyncApi(
  async (_req: Request, ctx: { params: Params }) => {
    await requirePermission("profile.delete");
    const { id } = await ctx.params;

    const existing = await prisma.bandwidthProfile.findUnique({
      where: { id },
    });
    if (!existing) throw new Error("Profil bandwidth tidak ditemukan.");

    const attachedCount = await prisma.customer.count({
      where: { profileId: id },
    });
    if (attachedCount > 0) {
      throw new Error(
        `Profil tidak dapat dihapus karena masih digunakan oleh ${attachedCount} pelanggan. Silakan pindahkan pelanggan terlebih dahulu.`,
      );
    }

    await prisma.bandwidthProfile.delete({ where: { id } });
    return NextResponse.json({ success: true });
  },
);
