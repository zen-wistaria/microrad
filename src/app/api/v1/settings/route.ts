import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export const GET = asyncApi(async () => {
  await requirePermission("setting.read");
  const company = await prisma.companyProfile.findUnique({ where: { id: 1 } });
  return NextResponse.json({ data: company });
});

export const PUT = asyncApi(async (req: Request) => {
  await requirePermission("setting.update");
  const body = (await req.json()) as {
    brandName?: string;
    fullName?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    npwp?: string;
    licenseNo?: string;
  };

  if (body.brandName?.trim() === "")
    throw new Error("Nama brand tidak boleh kosong.");
  if (body.fullName?.trim() === "") {
    throw new Error("Nama panjang perusahaan tidak boleh kosong.");
  }

  const data = {
    ...(body.brandName !== undefined
      ? { brandName: body.brandName.trim() }
      : {}),
    ...(body.fullName !== undefined ? { fullName: body.fullName.trim() } : {}),
    ...(body.address !== undefined ? { address: body.address } : {}),
    ...(body.phone !== undefined ? { phone: body.phone } : {}),
    ...(body.email !== undefined ? { email: body.email } : {}),
    ...(body.website !== undefined ? { website: body.website } : {}),
    ...(body.npwp !== undefined ? { npwp: body.npwp } : {}),
    ...(body.licenseNo !== undefined ? { licenseNo: body.licenseNo } : {}),
  };

  const company = await prisma.companyProfile.upsert({
    where: { id: 1 },
    update: data,
    create: {
      id: 1,
      brandName: body.brandName ?? "",
      fullName: body.fullName ?? "",
      ...data,
    },
  });
  return NextResponse.json({ data: company });
});
