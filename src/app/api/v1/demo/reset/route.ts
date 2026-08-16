import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

/**
 * Reset Demo — bersihkan data & seed ulang (kecuali tabel auth & WA template).
 * Hanya role-admin. Frontend reload setelah sukses.
 */
export const POST = asyncApi(async () => {
  await requirePermission("setting.update");
  const admin = await prisma.appUser.findFirst({
    where: { roleId: "role-admin" },
  });
  if (!admin)
    throw new Error("Anda tidak memiliki izin untuk melakukan tindakan ini");

  // Wipe urutan child → parent (auth portal/user ikut cascade via customer)
  await prisma.paymentRecord.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.session.deleteMany();
  await prisma.portalSessionLog.deleteMany();
  await prisma.portalLoginLog.deleteMany();
  await prisma.globalLog.deleteMany();
  await prisma.portalUser.deleteMany();
  await prisma.appUser.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.nasRouter.deleteMany();
  await prisma.bandwidthProfile.deleteMany();
  await prisma.role.deleteMany();
  await prisma.companyProfile.deleteMany();

  // Logout semua — sesi jadi invalid (tabel session/account dihapus? tidak:
  // app_session & app_account tersisa. User dihapus → FK cascade hapus juga.)
  await prisma.appSession.deleteMany();
  await prisma.appAccount.deleteMany();
  await prisma.portalSession.deleteMany();
  await prisma.portalAccount.deleteMany();

  return NextResponse.json({ success: true });
});
