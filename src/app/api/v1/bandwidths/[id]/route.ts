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

  const bandwidth = await prisma.bandwidth.findUnique({
    where: { id },
    include: {
      _count: {
        select: { pppProfiles: true },
      },
    },
  });

  if (!bandwidth) {
    return NextResponse.json(
      { error: "Konfigurasi bandwidth tidak ditemukan." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      ...bandwidth,
      createdAt: bandwidth.createdAt.toISOString(),
      updatedAt: bandwidth.updatedAt.toISOString(),
      pppProfileCount: bandwidth._count.pppProfiles,
    },
  });
});

export const PUT = asyncApi(async (req: Request, { params }: Params) => {
  await requirePermission("profile.update");
  const { id } = await params;
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

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.bandwidth.update({
      where: { id },
      data: {
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
      include: {
        pppProfiles: { select: { id: true } },
      },
    });

    // Bulk sync RADIUS ke seluruh PPP Profile yang memakai bandwidth ini
    for (const p of res.pppProfiles) {
      await syncPppProfileRadiusBulk(tx, p.id);
    }

    return res;
  });

  return NextResponse.json({
    data: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      pppProfileCount: updated.pppProfiles.length,
    },
  });
});

export const DELETE = asyncApi(async (_req: Request, { params }: Params) => {
  await requirePermission("profile.delete");
  const { id } = await params;

  const count = await prisma.pppProfile.count({
    where: { bandwidthId: id },
  });
  if (count > 0) {
    throw new Error(
      `Konfigurasi bandwidth tidak dapat dihapus karena sedang digunakan oleh ${count} PPP Profile.`,
    );
  }

  await prisma.bandwidth.delete({ where: { id } });

  return NextResponse.json({ data: { id, deleted: true } });
});
