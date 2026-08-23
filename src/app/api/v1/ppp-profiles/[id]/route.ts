import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { validatePppProfileIps } from "../route";

interface Params {
  params: Promise<{ id: string }>;
}

export const GET = asyncApi(async (_req: Request, { params }: Params) => {
  await requirePermission("profile.read");
  const { id } = await params;

  const profile = await prisma.pppProfile.findUnique({
    where: { id },
    include: {
      nasRouter: {
        select: { id: true, name: true, ipAddress: true },
      },
      profileGroup: {
        select: { id: true, name: true },
      },
    },
  });

  if (!profile) {
    return NextResponse.json(
      { error: "PPP Profile tidak ditemukan." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      ...profile,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    },
  });
});

export const PUT = asyncApi(async (req: Request, { params }: Params) => {
  await requirePermission("profile.update");
  const { id } = await params;
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

  const updated = await prisma.pppProfile.update({
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

  return NextResponse.json({
    data: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});

export const DELETE = asyncApi(async (_req: Request, { params }: Params) => {
  await requirePermission("profile.delete");
  const { id } = await params;

  await prisma.pppProfile.delete({ where: { id } });

  return NextResponse.json({ data: { id, deleted: true } });
});
