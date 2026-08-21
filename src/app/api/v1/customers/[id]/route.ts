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

  // ── CoA: bila profil berubah & user sedang online → push rate-limit baru
  // tanpa disconnect (RFC 5176). Gagal → fallback kick agar re-login.
  const { sendCoa } = await import("@/lib/radius-coa");
  const profileChanged =
    "profileId" in body && body.profileId !== existing.profileId;
  const newProfile =
    profileChanged && customer.profileId
      ? await prisma.bandwidthProfile.findUnique({
          where: { id: customer.profileId },
        })
      : null;
  if (profileChanged && newProfile) {
    try {
      const online = await prisma.radAcct.findFirst({
        where: { username: customer.username, acctStopTime: null },
        orderBy: { acctStartTime: "desc" },
        select: { acctSessionId: true },
      });
      if (online) {
        const rate = await import("@/lib/radius-format").then((m) =>
          m.rateLimitValue({
            maxDownload: `${newProfile.rateLimitDown}M`,
            maxUpload: `${newProfile.rateLimitUp}M`,
            burstDownload: newProfile.burstLimitDown
              ? `${newProfile.burstLimitDown}k`
              : undefined,
            burstUpload: newProfile.burstLimitUp
              ? `${newProfile.burstLimitUp}k`
              : undefined,
            burstThresholdDownload: newProfile.burstThresholdDown
              ? `${newProfile.burstThresholdDown}k`
              : undefined,
            burstThresholdUp: newProfile.burstThresholdUp
              ? `${newProfile.burstThresholdUp}k`
              : undefined,
            burstTimeSeconds: newProfile.burstTimeSeconds ?? undefined,
            priority: newProfile.priority ?? undefined,
            limitAtDownload: newProfile.limitAtDown
              ? `${newProfile.limitAtDown}k`
              : undefined,
            limitAtUp: newProfile.limitAtUp
              ? `${newProfile.limitAtUp}k`
              : undefined,
          }),
        );
        const coa = await sendCoa(
          customer.username,
          { "Mikrotik-Rate-Limit": rate },
          { acctSessionId: online.acctSessionId ?? undefined },
        );
        if (!coa.success) {
          // CoA ditolak (RouterOS: Unsupported-Extension utk Mikrotik-Rate-Limit)
          // atau tidak dijawab → kick agar sesi re-login dgn rate baru
          console.warn(
            `[coa] rate-limit utk ${customer.username} tidak diterapkan via ` +
              `CoA (${coa.code ?? "no-ack"}) — fallback disconnect agar re-login.`,
          );
          const { kickSessionByUsername } = await import(
            "@/lib/mikrotik-disconnect"
          );
          await kickSessionByUsername(customer.username, customer.nasId);
        }
      }
    } catch (e) {
      console.warn("[coa] gagal push rate-limit utk", customer.username, e);
    }
  }

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
