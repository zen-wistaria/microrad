import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { syncPppProfileRadiusBulk } from "@/lib/radsync";

interface Params {
  params: Promise<{ id: string }>;
}

export const GET = asyncApi(async (_req: Request, { params }: Params) => {
  await requirePermission("profile.read");
  const { id } = await params;

  const profile = await prisma.pppProfile.findUnique({
    where: { id },
    include: {
      bandwidth: true,
      _count: {
        select: { customers: true },
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
      customerCount: profile._count.customers,
    },
  });
});

export const PUT = asyncApi(async (req: Request, { params }: Params) => {
  await requirePermission("profile.update");
  const { id } = await params;
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

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.pppProfile.update({
      where: { id },
      data: {
        name,
        price,
        bandwidthId,
        priority,
      },
      include: {
        bandwidth: true,
        _count: {
          select: { customers: true },
        },
      },
    });

    // Bulk sync RADIUS ke seluruh pelanggan yang memakai PPP Profile ini
    await syncPppProfileRadiusBulk(tx, id);

    return res;
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
    where: { profileId: id },
  });
  if (count > 0) {
    throw new Error(
      `PPP Profile tidak dapat dihapus karena sedang digunakan oleh ${count} pelanggan.`,
    );
  }

  await prisma.pppProfile.delete({ where: { id } });

  return NextResponse.json({ data: { id, deleted: true } });
});
