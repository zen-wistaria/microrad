import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { syncSingleProfileToRouters } from "@/lib/mikrotik-ppp-profile";
import { prisma } from "@/lib/prisma";
import { syncAreaGroupRadiusBulk, syncPppProfileIpPool } from "@/lib/radsync";

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
  local?: string | null,
  start?: string | null,
  end?: string | null,
) {
  if (!start || !end) return;
  const startNum = ipToNumber(start);
  const endNum = ipToNumber(end);

  if (startNum > endNum) {
    throw new Error(
      "Range IP Start harus lebih kecil atau sama dengan Range IP End.",
    );
  }

  if (local?.trim()) {
    const localNum = ipToNumber(local.trim());
    if (localNum >= startNum && localNum <= endNum) {
      throw new Error(
        `Local Address Gateway (${local}) tidak boleh berada di dalam rentang Range IP (${start} - ${end}).`,
      );
    }
  }
}

export const GET = asyncApi(async (req: Request) => {
  await requirePermission("profile.read");
  const url = new URL(req.url);
  const search = url.searchParams.get("search") || undefined;
  const serviceType = url.searchParams.get("serviceType") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const limit = parseInt(url.searchParams.get("limit") || "10", 10);

  const safeLimit = Math.min(Math.max(limit || 10, 1), 50);
  const safePage = Math.max(page || 1, 1);

  const where: Record<string, unknown> = {};
  if (serviceType && (serviceType === "PPP" || serviceType === "HOTSPOT")) {
    where.serviceType = serviceType;
  }
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
        areaGroup: {
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  const data = profiles.map((p) => ({
    ...p,
    type: p.serviceType, // backward compatibility
    profileGroupId: p.areaGroupId,
    profileGroup: p.areaGroup,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return NextResponse.json({ data, total });
});

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("profile.create");
  const body = await req.json();

  const name = body.name?.trim();
  if (!name) throw new Error("Nama Profile wajib diisi.");

  const serviceType = (body.serviceType || body.type || "PPP").toUpperCase();
  const ipModule = body.ipModule || "sql";
  const localAddress = body.localAddress?.trim() || null;
  const rangeIpStart = body.rangeIpStart?.trim() || null;
  const rangeIpEnd = body.rangeIpEnd?.trim() || null;
  const dnsServers = body.dnsServers?.trim() || "8.8.8.8,8.8.4.4";
  const sessionTimeout = body.sessionTimeout
    ? parseInt(String(body.sessionTimeout), 10)
    : null;
  const idleTimeout = body.idleTimeout
    ? parseInt(String(body.idleTimeout), 10)
    : null;
  const parentQueue = body.parentQueue?.trim() || null;

  // Khusus Hotspot
  const insertQueueBefore = body.insertQueueBefore?.trim() || null;
  const keepaliveTimeout = body.keepaliveTimeout?.trim() || null;
  const addMacCookie = Boolean(body.addMacCookie);
  const macCookieTimeout = body.macCookieTimeout?.trim() || null;

  const areaGroupId =
    body.areaGroupId?.trim() || body.profileGroupId?.trim() || null;

  if (rangeIpStart && rangeIpEnd) {
    validatePppProfileIps(localAddress, rangeIpStart, rangeIpEnd);
  }

  if (areaGroupId) {
    const area = await prisma.areaGroup.findUnique({
      where: { id: areaGroupId },
    });
    if (!area) throw new Error("Wilayah (Area Group) tidak ditemukan.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const ppp = await tx.pppProfile.create({
      data: {
        id: `ppp-${Date.now()}`,
        name,
        serviceType,
        ipModule,
        localAddress,
        rangeIpStart,
        rangeIpEnd,
        dnsServers,
        sessionTimeout,
        idleTimeout,
        parentQueue,
        insertQueueBefore,
        keepaliveTimeout,
        addMacCookie,
        macCookieTimeout,
        areaGroupId,
      },
      include: {
        areaGroup: {
          select: { id: true, name: true },
        },
      },
    });

    await syncPppProfileIpPool(tx, ppp.id);
    if (ppp.areaGroupId) {
      await syncAreaGroupRadiusBulk(tx, ppp.areaGroupId);
    }
    return ppp;
  });

  // Otomatis sinkronisasi pembuatan profile ke seluruh router di Wilayah terkait via API
  let syncResults: string[] = [];
  if (created.areaGroupId) {
    try {
      const syncRes = await syncSingleProfileToRouters(created.id);
      syncResults = syncRes.results;
    } catch (err) {
      console.warn(`[ppp-profile-create] Auto sync ke router gagal:`, err);
    }
  }

  return NextResponse.json(
    {
      data: {
        ...created,
        type: created.serviceType,
        profileGroupId: created.areaGroupId,
        profileGroup: created.areaGroup,
        syncResults,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    },
    { status: 201 },
  );
});
