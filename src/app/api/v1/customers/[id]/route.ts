import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { kickSessionByUsername } from "@/lib/mikrotik-disconnect";
import { prisma } from "@/lib/prisma";
import { getOnlineRadacct } from "@/lib/radacct-sessions";
import {
  moveCustomerRadius,
  removeCustomerRadius,
  syncCustomerRadius,
} from "@/lib/radsync";

type Params = Promise<{ id: string }>;

export const GET = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("customer.read");
  const { id } = await ctx.params;
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new Error("Pelanggan tidak ditemukan.");

  // Status online dihitung dari radacct langsung (sumber kebenaran
  // FreeRADIUS) — bukan field basi/currentSessionId.
  const onlineAcct = await getOnlineRadacct({ username: customer.username });
  const activeRow = onlineAcct[0] ?? null;
  const lastSeenAt = customer.lastSeenAt
    ? new Date(customer.lastSeenAt).toISOString()
    : undefined;
  const live = activeRow
    ? {
        id: `acct-${activeRow.acctUniqueId}`,
        startedAt: (activeRow.acctStartTime ?? new Date()).toISOString(),
        durationSeconds: activeRow.acctSessionTime
          ? Number(activeRow.acctSessionTime)
          : 0,
        inputBytes: Number(activeRow.acctInputOctets ?? 0),
        outputBytes: Number(activeRow.acctOutputOctets ?? 0),
      }
    : null;

  return NextResponse.json({
    data: {
      ...customer,
      lastSeenAt,
      createdAt: new Date(customer.createdAt).toISOString(),
      updatedAt: new Date(customer.updatedAt).toISOString(),
    },
    live,
  });
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
    bindOnNas?: boolean;
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

  const customer = await prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
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
        ...(body.bindOnNas !== undefined ? { bindOnNas: body.bindOnNas } : {}),
        ...(body.password !== undefined
          ? { password: body.password || undefined }
          : {}),
      },
    });

    // ── radsync (tabel RADIUS bersama, atomik dengan CRUD) ──
    const usernameChanged =
      body.username !== undefined && body.username.trim() !== existing.username;
    if (usernameChanged) {
      await moveCustomerRadius(tx, existing.username, updated.username);
    }
    const profile = updated.profileId
      ? await tx.bandwidthProfile.findUnique({
          where: { id: updated.profileId },
          select: {
            rateLimitDown: true,
            rateLimitUp: true,
            burstLimitDown: true,
            burstLimitUp: true,
            burstThresholdDown: true,
            burstThresholdUp: true,
            burstTimeSeconds: true,
            priority: true,
            limitAtDown: true,
            limitAtUp: true,
          },
        })
      : null;
    const router = updated.nasId
      ? await tx.nasRouter.findUnique({
          where: { id: updated.nasId },
          select: { ipAddress: true },
        })
      : null;
    await syncCustomerRadius(
      tx,
      updated,
      profile,
      body.password ?? undefined,
      router?.ipAddress,
    );
    return updated;
  });
  return NextResponse.json({ data: customer });
});

export const DELETE = asyncApi(
  async (_req: Request, ctx: { params: Params }) => {
    await requirePermission("customer.delete");
    const { id } = await ctx.params;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new Error("Pelanggan tidak ditemukan.");

    await prisma.$transaction(async (tx) => {
      // Kick sesi aktif di router (best-effort) — FreeRADIUS Stop menyusul
      await kickSessionByUsername(existing.username, existing.nasId);

      // radsync: hapus baris RADIUS (histori radacct tetap)
      await removeCustomerRadius(tx, existing.username);
      await tx.customer.delete({ where: { id } });
    });
    return NextResponse.json({ success: true });
  },
);

/** POST /api/v1/customers/[id]/disconnect — putus sesi aktif pelanggan.
 * Sesi online dibaca dari radacct; kick dilakukan via RouterOS API
 * (best-effort). FreeRADIUS akan menerima Accounting-Stop dari router
 * dan sesi hilang dari daftar online. */
export const POST = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("customer.update");
  const { id } = await ctx.params;

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) throw new Error("Pelanggan tidak ditemukan.");

  const online = await prisma.radAcct.findMany({
    where: { username: existing.username, acctStopTime: null },
    orderBy: { acctStartTime: "desc" },
    take: 1,
  });
  if (online[0]) {
    // Kick di router (best-effort) — session masih online di radacct
    const { kickSessionByUsername } = await import("@/lib/mikrotik-disconnect");
    await kickSessionByUsername(existing.username, existing.nasId);
    await prisma.customer.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });
  }
  return NextResponse.json({ success: true });
});
