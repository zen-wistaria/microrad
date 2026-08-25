import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

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
    where.name = { contains: search, mode: "insensitive" };
  }

  const [total, profiles] = await Promise.all([
    prisma.internetProfile.count({ where }),
    prisma.internetProfile.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      include: {
        bandwidth: true,
        _count: {
          select: { customers: true },
        },
      },
    }),
  ]);

  const data = profiles.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    customerCount: p._count.customers,
  }));

  return NextResponse.json({ data, total });
});

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("profile.create");
  const body = await req.json();

  const name = body.name?.trim();
  if (!name) throw new Error("Nama Paket Internet wajib diisi.");

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

  const created = await prisma.internetProfile.create({
    data: {
      id: `net-${Date.now()}`,
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
