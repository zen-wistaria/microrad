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

  const [total, bandwidths] = await Promise.all([
    prisma.bandwidth.count({ where }),
    prisma.bandwidth.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      include: {
        _count: {
          select: { internetProfiles: true },
        },
      },
    }),
  ]);

  const data = bandwidths.map((b) => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    pppProfileCount: b._count.internetProfiles,
  }));

  return NextResponse.json({ data, total });
});

export const POST = asyncApi(async (req: Request) => {
  await requirePermission("profile.create");
  const body = await req.json();

  const name = body.name?.trim();
  if (!name || name.length < 3) {
    throw new Error("Nama bandwidth minimal 3 karakter.");
  }

  const maxDownload = Number(body.maxDownload);
  const maxUpload = Number(body.maxUpload);
  if (!maxDownload || maxDownload <= 0) {
    throw new Error("Max Download wajib diisi lebih dari 0.");
  }
  if (!maxUpload || maxUpload <= 0) {
    throw new Error("Max Upload wajib diisi lebih dari 0.");
  }

  const minDownload = body.minDownload ? Number(body.minDownload) : null;
  const minUpload = body.minUpload ? Number(body.minUpload) : null;
  const minDownloadUnit = body.minDownloadUnit || "Kbps";
  const minUploadUnit = body.minUploadUnit || "Kbps";
  const maxDownloadUnit = body.maxDownloadUnit || "Mbps";
  const maxUploadUnit = body.maxUploadUnit || "Mbps";

  const toKbps = (val: number, unit?: string | null) =>
    (unit ?? "Mbps").toLowerCase().startsWith("m") ? val * 1000 : val;

  // Validasi Limit-At (Garansi Min / CIR): Tidak boleh melebihi Max limit
  if (minDownload && minDownload > 0) {
    const minDownKbps = toKbps(minDownload, minDownloadUnit);
    const maxDownKbps = toKbps(maxDownload, maxDownloadUnit);
    if (minDownKbps > maxDownKbps) {
      throw new Error(
        "Garansi Min (Limit-at) Download tidak boleh melebihi Max Download.",
      );
    }
  }

  if (minUpload && minUpload > 0) {
    const minUpKbps = toKbps(minUpload, minUploadUnit);
    const maxUpKbps = toKbps(maxUpload, maxUploadUnit);
    if (minUpKbps > maxUpKbps) {
      throw new Error(
        "Garansi Min (Limit-at) Upload tidak boleh melebihi Max Upload.",
      );
    }
  }

  // Burst validation: jika salah satu diisi, seluruh field burst wajib diisi
  const hasAnyBurst = Boolean(
    body.burstLimitDownload ||
      body.burstLimitUpload ||
      body.burstThresholdDownload ||
      body.burstThresholdUpload ||
      body.burstTime,
  );

  let burstLimitDownload: number | null = null;
  let burstLimitUpload: number | null = null;
  let burstThresholdDownload: number | null = null;
  let burstThresholdUpload: number | null = null;
  let burstTime: number | null = null;

  if (hasAnyBurst) {
    burstLimitDownload = Number(body.burstLimitDownload);
    burstLimitUpload = Number(body.burstLimitUpload);
    burstThresholdDownload = Number(body.burstThresholdDownload);
    burstThresholdUpload = Number(body.burstThresholdUpload);
    burstTime = Number(body.burstTime);

    if (
      !burstLimitDownload ||
      !burstLimitUpload ||
      !burstThresholdDownload ||
      !burstThresholdUpload ||
      !burstTime
    ) {
      throw new Error(
        "Jika konfigurasi burst diaktifkan, seluruh nilai burst (Limit, Threshold, dan Time) wajib diisi lengkap.",
      );
    }

    const burstLimitDownloadUnit = body.burstLimitDownloadUnit || "Mbps";
    const burstLimitUploadUnit = body.burstLimitUploadUnit || "Mbps";
    const burstThresholdDownloadUnit =
      body.burstThresholdDownloadUnit || "Mbps";
    const burstThresholdUploadUnit = body.burstThresholdUploadUnit || "Mbps";

    const burstDownKbps = toKbps(burstLimitDownload, burstLimitDownloadUnit);
    const maxDownKbps = toKbps(maxDownload, maxDownloadUnit);
    if (burstDownKbps <= maxDownKbps) {
      throw new Error(
        "Burst Limit Download harus lebih besar dari Max Download.",
      );
    }

    const burstUpKbps = toKbps(burstLimitUpload, burstLimitUploadUnit);
    const maxUpKbps = toKbps(maxUpload, maxUploadUnit);
    if (burstUpKbps <= maxUpKbps) {
      throw new Error("Burst Limit Upload harus lebih besar dari Max Upload.");
    }

    const threshDownKbps = toKbps(
      burstThresholdDownload,
      burstThresholdDownloadUnit,
    );
    if (threshDownKbps > burstDownKbps) {
      throw new Error(
        "Burst Threshold Download tidak boleh melebihi Burst Limit Download.",
      );
    }

    const threshUpKbps = toKbps(burstThresholdUpload, burstThresholdUploadUnit);
    if (threshUpKbps > burstUpKbps) {
      throw new Error(
        "Burst Threshold Upload tidak boleh melebihi Burst Limit Upload.",
      );
    }
  }

  const created = await prisma.bandwidth.create({
    data: {
      id: `bw-${Date.now()}`,
      name,
      minDownload,
      minDownloadUnit: body.minDownloadUnit || "Kbps",
      minUpload,
      minUploadUnit: body.minUploadUnit || "Kbps",
      maxDownload,
      maxDownloadUnit: body.maxDownloadUnit || "Mbps",
      maxUpload,
      maxUploadUnit: body.maxUploadUnit || "Mbps",
      burstLimitDownload,
      burstLimitDownloadUnit: hasAnyBurst
        ? body.burstLimitDownloadUnit || "Mbps"
        : null,
      burstLimitUpload,
      burstLimitUploadUnit: hasAnyBurst
        ? body.burstLimitUploadUnit || "Mbps"
        : null,
      burstThresholdDownload,
      burstThresholdDownloadUnit: hasAnyBurst
        ? body.burstThresholdDownloadUnit || "Mbps"
        : null,
      burstThresholdUpload,
      burstThresholdUploadUnit: hasAnyBurst
        ? body.burstThresholdUploadUnit || "Mbps"
        : null,
      burstTime,
    },
  });

  return NextResponse.json(
    {
      data: {
        ...created,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        pppProfileCount: 0,
      },
    },
    { status: 201 },
  );
});
