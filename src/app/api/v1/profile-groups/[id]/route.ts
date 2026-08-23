import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { validateProfileGroupIps } from "../route";

interface Params {
  params: Promise<{ id: string }>;
}

export const GET = asyncApi(async (_req: Request, { params }: Params) => {
  await requirePermission("profile.read");
  const { id } = await params;

  const group = await prisma.profileGroup.findUnique({
    where: { id },
    include: {
      nasRouter: {
        select: { id: true, name: true, ipAddress: true },
      },
      _count: {
        select: { customers: true },
      },
    },
  });

  if (!group) {
    return NextResponse.json(
      { error: "Profile Group tidak ditemukan." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      ...group,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      customerCount: group._count.customers,
    },
  });
});

export const PUT = asyncApi(async (req: Request, { params }: Params) => {
  await requirePermission("profile.update");
  const { id } = await params;
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

  const updated = await prisma.profileGroup.update({
    where: { id },
    data: {
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
      _count: {
        select: { customers: true },
      },
    },
  });

  return NextResponse.json({
    data: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      customerCount: updated._count.customers,
    },
  });
});

export const DELETE = asyncApi(async (_req: Request, { params }: Params) => {
  await requirePermission("profile.delete");
  const { id } = await params;

  const count = await prisma.customer.count({
    where: { profileGroupId: id },
  });
  if (count > 0) {
    throw new Error(
      `Profile Group tidak dapat dihapus karena sedang digunakan oleh ${count} pelanggan.`,
    );
  }

  await prisma.profileGroup.delete({ where: { id } });

  return NextResponse.json({ data: { id, deleted: true } });
});
