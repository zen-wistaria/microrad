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
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      portalUser: {
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
        },
      },
    },
  });
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
    sessionMode?: "single" | "multi" | string;
    maxSimultaneous?: number;
    allowedNasIps?: string[];
    password?: string;
    portalPassword?: string;
  };

  const existing = await prisma.customer.findUnique({
    where: { id },
    include: { portalUser: true },
  });
  if (!existing) throw new Error("Pelanggan tidak ditemukan.");

  if (body.username !== undefined) {
    const username = body.username.trim();
    if (!username) throw new Error("Username PPPoE tidak boleh kosong.");
    const [dupCustomer, dupRad] = await Promise.all([
      prisma.customer.findFirst({
        where: {
          username: { equals: username, mode: "insensitive" },
          NOT: { id },
        },
      }),
      prisma.radCheck.findFirst({
        where: {
          username,
          NOT: { username: existing.username },
        },
      }),
    ]);
    if (dupCustomer || dupRad) {
      throw new Error(
        `Username PPPoE '${username}' sudah digunakan pelanggan lain.`,
      );
    }
  }

  // Validasi email jika diubah
  if (body.email?.trim()) {
    const email = body.email.trim();
    const [dupCustEmail, dupPortalEmail] = await Promise.all([
      prisma.customer.findFirst({
        where: {
          email: { equals: email, mode: "insensitive" },
          NOT: { id },
        },
      }),
      prisma.portalUser.findFirst({
        where: {
          email,
          NOT: existing.portalUser ? { id: existing.portalUser.id } : undefined,
        },
      }),
    ]);
    if (dupCustEmail || dupPortalEmail) {
      throw new Error(`Email '${email}' sudah digunakan pelanggan lain.`);
    }
  }

  const usernameChanged =
    body.username !== undefined && body.username.trim() !== existing.username;

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
          ? { email: body.email.trim() || null }
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
        ...(body.sessionMode !== undefined
          ? { sessionMode: body.sessionMode }
          : {}),
        ...(body.maxSimultaneous !== undefined
          ? { maxSimultaneous: Number(body.maxSimultaneous) || 1 }
          : {}),
        ...(body.allowedNasIps !== undefined
          ? {
              allowedNasIps: Array.isArray(body.allowedNasIps)
                ? body.allowedNasIps
                : [],
            }
          : {}),
        ...(body.password !== undefined
          ? { password: body.password || undefined }
          : {}),
      },
    });

    // ── Update / Create Akun Portal Pelanggan ──
    const targetEmail =
      body.email !== undefined ? body.email.trim() || null : existing.email;
    const { hashPassword } = await import("@better-auth/utils/password");

    if (existing.portalUser) {
      await tx.portalUser.update({
        where: { id: existing.portalUser.id },
        data: {
          username: updated.username,
          email: targetEmail,
          name: updated.fullName || updated.username,
        },
      });
      if (body.portalPassword?.trim()) {
        const hashedPassword = await hashPassword(body.portalPassword.trim());
        await tx.portalAccount.updateMany({
          where: { userId: existing.portalUser.id },
          data: {
            password: hashedPassword,
            accountId: targetEmail || updated.username,
          },
        });
      } else if (targetEmail !== existing.email) {
        await tx.portalAccount.updateMany({
          where: { userId: existing.portalUser.id },
          data: { accountId: targetEmail || updated.username },
        });
      }
    } else {
      // Buat portal user baru jika sebelumnya belum ada
      const portalPassword = body.portalPassword?.trim() || "password123";
      const hashedPassword = await hashPassword(portalPassword);
      const portalUserId = `usr-${updated.id}`;
      await tx.portalUser.create({
        data: {
          id: portalUserId,
          name: updated.fullName || updated.username,
          username: updated.username,
          email: targetEmail || undefined,
          customerId: updated.id,
          accounts: {
            create: {
              id: `pacc-${portalUserId}-credential`,
              accountId: targetEmail || updated.username,
              providerId: "credential",
              password: hashedPassword,
            },
          },
        },
      });
    }

    // ── Jika status menjadi disabled, batalkan seluruh sesi login portal yang sedang aktif ──
    if (updated.status === "disabled") {
      const portalUser =
        existing.portalUser ??
        (await tx.portalUser.findUnique({
          where: { customerId: updated.id },
          select: { id: true },
        }));
      if (portalUser) {
        await tx.portalSession.deleteMany({
          where: { userId: portalUser.id },
        });
      }
    }

    // ── radsync (tabel RADIUS bersama, atomik dengan CRUD) ──
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

  // Jika username berubah dan sedang online di router, putus sesi lama agar login dengan username baru
  if (usernameChanged) {
    try {
      const { kickSessionByUsername } = await import(
        "@/lib/mikrotik-disconnect"
      );
      await kickSessionByUsername(existing.username, existing.nasId);
    } catch (err) {
      console.warn(
        `[disconnect] gagal putus sesi lama saat username diganti:`,
        err,
      );
    }
  }

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

  // ── Otomatis putus koneksi jika status diubah menjadi suspended atau disabled ──
  if (
    body.status !== undefined &&
    body.status !== "active" &&
    existing.status === "active"
  ) {
    try {
      const online = await prisma.radAcct.findFirst({
        where: { username: customer.username, acctStopTime: null },
        orderBy: { acctStartTime: "desc" },
        select: { acctSessionId: true },
      });
      if (online) {
        const { sendDisconnect } = await import("@/lib/radius-coa");
        const coaResult = await sendDisconnect(customer.username, {
          acctSessionId: online.acctSessionId ?? undefined,
        });
        if (!coaResult.success) {
          const { kickSessionByUsername } = await import(
            "@/lib/mikrotik-disconnect"
          );
          await kickSessionByUsername(customer.username, customer.nasId);
        }
      }
    } catch (err) {
      console.warn(
        `[disconnect] gagal putus sesi saat status ${customer.username} diubah:`,
        err,
      );
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
