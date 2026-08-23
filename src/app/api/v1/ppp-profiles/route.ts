import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const GET = asyncApi(async () => {
  await requirePermission("profile.read");

  const profiles = await prisma.pppProfile.findMany({
    orderBy: { name: "asc" },
    include: {
      bandwidth: true,
      _count: {
        select: { customers: true },
      },
    },
  });

  const data = profiles.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    customerCount: p._count.customers,
  }));

  return NextResponse.json({ data });
});

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("profile.create");
  const body = await req.json();

  const name = body.name?.trim();
  if (!name) throw new Error("Nama PPP Profile wajib diisi.");

  const price = Number(body.price ?? 0);
  if (Number.isNaN(price) || price < 0) {
    throw new Error("Harga paket minimal Rp 0.");
  }

  const bandwidthId = body.bandwidthId?.trim();
  if (!bandwidthId) throw new Error("Wajib memilih Konfigurasi Bandwidth.");

  const bw = await prisma.bandwidth.findUnique({ where: { id: bandwidthId } });
  if (!bw) throw new Error("Konfigurasi Bandwidth tidak ditemukan.");

  const priority = Number(body.priority || 8);
  if (Number.isNaN(priority) || priority < 1 || priority > 8) {
    throw new Error("Priority harus berada di antara 1 dan 8.");
  }

  const created = await prisma.pppProfile.create({
    data: {
      id: `ppp-${Date.now()}`,
      name,
      price,
      bandwidthId,
      priority,
    },
    include: {
      bandwidth: true,
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
