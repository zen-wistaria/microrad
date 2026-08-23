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

export function validateProfileGroupIps(
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

  const groups = await prisma.profileGroup.findMany({
    orderBy: { name: "asc" },
    include: {
      nasRouter: {
        select: { id: true, name: true, ipAddress: true },
      },
      _count: {
        select: { customers: true },
      },
    },
  });

  const data = groups.map((g) => ({
    ...g,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    customerCount: g._count.customers,
  }));

  return NextResponse.json({ data });
});

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("profile.create");
  const body = await req.json();

  const name = body.name?.trim();
  if (!name) throw new Error("Nama Profile Group wajib diisi.");

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

  if (!localAddress) throw new Error("Local Address (Gateway) wajib diisi.");
  if (!rangeIpStart) throw new Error("Range IP Start wajib diisi.");
  if (!rangeIpEnd) throw new Error("Range IP End wajib diisi.");

  validateProfileGroupIps(localAddress, rangeIpStart, rangeIpEnd);

  const created = await prisma.profileGroup.create({
    data: {
      id: `grp-${Date.now()}`,
      name,
      nasId,
      type,
      ipModule,
      localAddress,
      rangeIpStart,
      rangeIpEnd,
      dnsServers,
      parentQueue,
    },
    include: {
      nasRouter: {
        select: { id: true, name: true, ipAddress: true },
      },
    },
  });

  return NextResponse.json(
    {
      data: {
        ...created,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        customerCount: 0,
      },
    },
    { status: 201 },
  );
});
