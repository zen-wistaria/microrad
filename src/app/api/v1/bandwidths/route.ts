import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const GET = asyncApi(async () => {
  await requirePermission("profile.read");

  const bandwidths = await prisma.bandwidth.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { pppProfiles: true },
      },
    },
  });

  const data = bandwidths.map((b) => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    pppProfileCount: b._count.pppProfiles,
  }));

  return NextResponse.json({ data });
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
