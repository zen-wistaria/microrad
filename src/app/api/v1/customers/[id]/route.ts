import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

export const GET = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("customer.read");
  const { id } = await ctx.params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new Error("Pelanggan tidak ditemukan.");
  return NextResponse.json({ data: customer });
});

export const PUT = asyncApi(async (req: Request, ctx: { params: Params }) => {
  await requirePermission("customer.update");
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    username?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    address?: string;
    status?: string;
    profileId?: string | null;
    staticIp?: string;
    nasId?: string | null;
    password?: string;
  };

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw new Error("Pelanggan tidak ditemukan.");

  if (body.username !== undefined) {
    const username = body.username.trim();
    const dup = await prisma.customer.findFirst({
      where: {
        username: { equals: username, mode: "insensitive" },
        NOT: { id },
      },
    });
    if (dup) {
      throw new Error(
        `Username PPPoE '${username}' sudah digunakan pelanggan lain.`,
      );
    }
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(body.username !== undefined
        ? { username: body.username.trim() }
        : {}),
      ...(body.fullName !== undefined
        ? { fullName: body.fullName.trim() || undefined }
        : {}),
      ...(body.email !== undefined
        ? { email: body.email.trim() || undefined }
        : {}),
      ...(body.phone !== undefined
        ? { phone: body.phone.trim() || undefined }
        : {}),
      ...(body.address !== undefined
        ? { address: body.address || undefined }
        : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...("profileId" in body ? { profileId: body.profileId ?? null } : {}),
      ...(body.staticIp !== undefined
        ? { staticIp: body.staticIp.trim() || undefined }
        : {}),
      ...("nasId" in body ? { nasId: body.nasId ?? null } : {}),
      ...(body.password !== undefined
        ? { password: body.password || undefined }
        : {}),
    },
  });
  return NextResponse.json({ data: customer });
});

export const DELETE = asyncApi(
  async (_req: Request, ctx: { params: Params }) => {
    await requirePermission("customer.delete");
    const { id } = await ctx.params;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new Error("Pelanggan tidak ditemukan.");

    // Putuskan sesi aktif terlebih dahulu (mirror perilaku mock)
    const activeSession = await prisma.session.findFirst({
      where: { customerId: id, stoppedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (activeSession) {
      const now = new Date();
      const elapsed = Math.max(
        1,
        Math.floor((now.getTime() - activeSession.startedAt.getTime()) / 1000),
      );
      await prisma.session.update({
        where: { id: activeSession.id },
        data: {
          stoppedAt: now,
          durationSeconds: elapsed,
          terminateCause: "Admin-Reset",
        },
      });
    }

    await prisma.customer.delete({ where: { id } });
    return NextResponse.json({ success: true });
  },
);

/** POST /api/v1/customers/[id]/disconnect — putus sesi aktif pelanggan */
export const POST = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("customer.update");
  const { id } = await ctx.params;

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw new Error("Pelanggan tidak ditemukan.");

  const activeSession = await prisma.session.findFirst({
    where: { customerId: id, stoppedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (activeSession) {
    await disconnectSessionRecord(activeSession.id, "Admin-Reset");
  }
  return NextResponse.json({ success: true });
});

/** Util bersama: putus sesi + sinkronisasi customer (dipakai sessions juga) */
export async function disconnectSessionRecord(
  sessionId: string,
  cause = "Admin-Reset",
) {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session || session.stoppedAt) return;
  const now = new Date();
  const elapsed = Math.max(
    1,
    Math.floor((now.getTime() - session.startedAt.getTime()) / 1000),
  );
  await prisma.$transaction([
    prisma.session.update({
      where: { id: sessionId },
      data: {
        stoppedAt: now,
        durationSeconds: elapsed,
        terminateCause: cause,
      },
    }),
    prisma.customer.update({
      where: { id: session.customerId },
      data: { currentSessionId: null, lastSeenAt: now },
    }),
  ]);
}
