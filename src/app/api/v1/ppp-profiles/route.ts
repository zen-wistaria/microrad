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

export const GET = asyncApi(async () => {
  await requirePermission("profile.read");

  const profiles = await prisma.pppProfile.findMany({
    orderBy: { name: "asc" },
    include: {
      nasRouter: {
        select: { id: true, name: true, ipAddress: true },
      },
      profileGroup: {
        select: { id: true, name: true },
      },
    },
  });

  const data = profiles.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  return NextResponse.json({ data });
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

  const created = await prisma.pppProfile.create({
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
