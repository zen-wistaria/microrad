import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export function ipToNumber(ip: string): number {
  const parts = ip.trim().split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
  ) {
    throw new Error(`Format IP Address '${ip}' tidak valid.`);
  }
  return (
    ((parts[0] << 24) >>> 0) +
    ((parts[1] << 16) >>> 0) +
    ((parts[2] << 8) >>> 0) +
    (parts[3] >>> 0)
  );
}

export function validatePppProfileIps(
  local: string,
  start: string,
  end: string,
) {
  const localNum = ipToNumber(local);
  const startNum = ipToNumber(start);
  const endNum = ipToNumber(end);

  if (startNum > endNum) {
    throw new Error(
      "Range IP Start harus lebih kecil atau sama dengan Range IP End.",
    );
  }

  if (localNum >= startNum && localNum <= endNum) {
    throw new Error(
      `Local Address Gateway (${local}) tidak boleh berada di dalam rentang Range IP (${start} - ${end}).`,
    );
  }
}

export const GET = asyncApi(async (req: Request) => {
  await requirePermission("profile.read");
  const url = new URL(req.url);
  const search = url.searchParams.get("search") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);

  const safeLimit = Math.min(Math.max(limit || 10, 1), 50);
  const safePage = Math.max(page || 1, 1);

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { localAddress: { contains: search, mode: "insensitive" } },
      { rangeIpStart: { contains: search, mode: "insensitive" } },
      { rangeIpEnd: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, profiles] = await Promise.all([
    prisma.pppProfile.count({ where }),
    prisma.pppProfile.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      include: {
        nasRouter: {
          select: { id: true, name: true, ipAddress: true },
        },
        profileGroup: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  const data = profiles.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return NextResponse.json({ data, total });
});

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("profile.create");
  const body = await req.json();

  const name = body.name?.trim();
  if (!name) throw new Error("Nama PPP Profile wajib diisi.");

  const nasId = body.nasId?.trim();
  if (!nasId) throw new Error("Wajib memilih Router NAS.");

  const router = await prisma.nasRouter.findUnique({ where: { id: nasId } });
  if (!router) throw new Error("Router NAS yang dipilih tidak ditemukan.");

  const type = body.type || "PPP";
  const ipModule = body.ipModule || "sql";
  const localAddress = body.localAddress?.trim();
  const rangeIpStart = body.rangeIpStart?.trim();
  const rangeIpEnd = body.rangeIpEnd?.trim();
  const dnsServers = body.dnsServers?.trim() || "8.8.8.8,8.8.4.4";
  const parentQueue = body.parentQueue?.trim() || null;
  const profileGroupId = body.profileGroupId?.trim() || null;

  if (!localAddress) throw new Error("Local Address (Gateway) wajib diisi.");
  if (!rangeIpStart) throw new Error("Range IP Start wajib diisi.");
  if (!rangeIpEnd) throw new Error("Range IP End wajib diisi.");

  validatePppProfileIps(localAddress, rangeIpStart, rangeIpEnd);

  if (profileGroupId) {
    const group = await prisma.profileGroup.findUnique({
      where: { id: profileGroupId },
    });
    if (!group) throw new Error("Profile Group tidak ditemukan.");
  }

  const { syncPppProfileIpPool, syncProfileGroupRadiusBulk } = await import(
    "@/lib/radsync"
  );

  const created = await prisma.$transaction(async (tx) => {
    const ppp = await tx.pppProfile.create({
      data: {
        id: `ppp-${Date.now()}`,
        name,
        nasId,
        type,
        ipModule,
        localAddress,
        rangeIpStart,
        rangeIpEnd,
        dnsServers,
        parentQueue,
        profileGroupId,
      },
      include: {
        nasRouter: {
          select: { id: true, name: true, ipAddress: true },
        },
        profileGroup: {
          select: { id: true, name: true },
        },
      },
    });

    await syncPppProfileIpPool(tx, ppp.id);
    if (ppp.profileGroupId) {
      await syncProfileGroupRadiusBulk(tx, ppp.profileGroupId);
    }
    return ppp;
  });

  // Otomatis sinkronisasi pembuatan profile ke router MikroTik via API
  const { syncPppProfileToRouter } = await import("@/lib/mikrotik-ppp-profile");
  await syncPppProfileToRouter({
    nasId: created.nasId,
    name: created.name,
    localAddress: created.localAddress,
    dnsServers: created.dnsServers,
    parentQueue: created.parentQueue,
  });

  return NextResponse.json(
    {
      data: {
        ...created,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    },
    { status: 201 },
  );
});
