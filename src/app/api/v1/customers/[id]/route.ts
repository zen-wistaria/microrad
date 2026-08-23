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
      profile: {
        include: {
          bandwidth: true,
        },
      },
      profileGroup: {
        include: {
          pppProfiles: {
            include: {
              nasRouter: true,
            },
          },
        },
      },
      router: true,
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
    profileGroupId?: string | null;
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
      throw new Error(`Username PPPoE '${username}' sudah terdaftar.`);
    }
  }

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
    const targetProfileId =
      "profileId" in body ? body.profileId : existing.profileId;
    const internetProf = targetProfileId
      ? await tx.internetProfile.findUnique({
          where: { id: targetProfileId },
          include: { bandwidth: true },
        })
      : null;

    const targetGroupId =
      "profileGroupId" in body ? body.profileGroupId : existing.profileGroupId;
    const profileGroup = targetGroupId
      ? await tx.profileGroup.findUnique({
          where: { id: targetGroupId },
          include: {
            pppProfiles: {
              include: { nasRouter: true },
            },
          },
        })
      : null;

    const groupNasIps = (profileGroup?.pppProfiles ?? [])
      .map((p) => p.nasRouter?.ipAddress)
      .filter((ip): ip is string => Boolean(ip));

    const nasId =
      profileGroup?.pppProfiles[0]?.nasId ?? body.nasId ?? existing.nasId;
    const nasIp = groupNasIps[0];
    const bindOnNas =
      body.bindOnNas !== undefined ? body.bindOnNas : existing.bindOnNas;
    const allowedNasIps = bindOnNas ? groupNasIps : [];

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
        ...("profileGroupId" in body
          ? { profileGroupId: body.profileGroupId ?? null }
          : {}),
        ...(body.staticIp !== undefined
          ? { staticIp: body.staticIp.trim() || undefined }
          : {}),
        nasId,
        bindOnNas,
        ...(body.sessionMode !== undefined
          ? { sessionMode: body.sessionMode }
          : {}),
        ...(body.maxSimultaneous !== undefined
          ? { maxSimultaneous: Number(body.maxSimultaneous) || 1 }
          : {}),
        allowedNasIps,
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
      }
    } else {
      let portalPassword = body.portalPassword?.trim();
      if (!portalPassword) {
        const { generatePppoePassword } = await import("@/lib/generators");
        portalPassword = generatePppoePassword(8);
      }
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

    const sqlNode =
      profileGroup?.pppProfiles.find((p) => p.ipModule === "sql") ??
      profileGroup?.pppProfiles[0];
    const poolName = sqlNode?.ipModule === "sql" ? sqlNode.name : null;

    await syncCustomerRadius(
      tx,
      { ...updated, poolName },
      internetProf
        ? {
            bandwidth: internetProf.bandwidth,
            priority: internetProf.priority,
            dnsServers: sqlNode?.dnsServers,
            poolName,
          }
        : null,
      body.password ?? undefined,
      nasIp,
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
      ? await prisma.internetProfile.findUnique({
          where: { id: customer.profileId },
          include: { bandwidth: true },
        })
      : null;
  if (profileChanged && newProfile && newProfile.bandwidth) {
    try {
      const online = await prisma.radAcct.findFirst({
        where: { username: customer.username, acctStopTime: null },
        orderBy: { acctStartTime: "desc" },
      });
      if (online) {
        const { formatBandwidthRateLimit } = await import(
          "@/lib/radius-format"
        );
        const rate = formatBandwidthRateLimit(
          newProfile.bandwidth,
          newProfile.priority,
        );
        const coaRes = await sendCoa(
          customer.username,
          { "Mikrotik-Rate-Limit": rate },
          {
            acctSessionId: online.acctSessionId ?? undefined,
            radiusIp: online.nasIpAddress ?? undefined,
          },
        );
        if (!coaRes.success) {
          await kickSessionByUsername(customer.username, customer.nasId);
        }
      }
    } catch (coaErr) {
      console.warn(
        `[coa] CoA failed, fallback kick for ${customer.username}:`,
        coaErr,
      );
      try {
        await kickSessionByUsername(customer.username, customer.nasId);
      } catch {
        // best-effort
      }
    }
  }

  return NextResponse.json({
    data: {
      ...customer,
      lastSeenAt: customer.lastSeenAt
        ? new Date(customer.lastSeenAt).toISOString()
        : undefined,
      createdAt: new Date(customer.createdAt).toISOString(),
      updatedAt: new Date(customer.updatedAt).toISOString(),
    },
  });
});

export const DELETE = asyncApi(
  async (_req: Request, ctx: { params: Params }) => {
    await requirePermission("customer.delete");
    const { id } = await ctx.params;
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new Error("Pelanggan tidak ditemukan.");

    // Putus koneksi aktif di MikroTik jika sedang online
    try {
      await kickSessionByUsername(customer.username, customer.nasId);
    } catch (err) {
      console.warn(
        `[delete-customer] Gagal putus sesi aktif ${customer.username}:`,
        err,
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Hapus baris RADIUS (radcheck, radreply, radnasallow)
      await removeCustomerRadius(tx, customer.username);

      // 2. Hapus sesi & akun portal jika ada
      const portalUser = await tx.portalUser.findUnique({
        where: { customerId: customer.id },
      });
      if (portalUser) {
        await tx.portalSession.deleteMany({
          where: { userId: portalUser.id },
        });
        await tx.portalAccount.deleteMany({
          where: { userId: portalUser.id },
        });
        await tx.portalUser.delete({ where: { id: portalUser.id } });
      }

      // 3. Hapus customer dari database aplikasi
      await tx.customer.delete({ where: { id } });
    });

    return NextResponse.json({
      data: { id, username: customer.username, deleted: true },
    });
  },
);
