/**
 * radsync — sinkronisasi data master aplikasi ke tabel RADIUS bersama
 * (radcheck / radreply / nas) yang dibaca FreeRADIUS v3.
 *
 * Semua fungsi menerima Prisma.TransactionClient agar dijalankan DALAM
 * transaksi yang sama dengan CRUD aplikasi (atomic).
 */
import type { Prisma } from "@/generated/prisma";
import { rateLimitValue } from "./radius-format";

/** Bentuk minimal data yang dibutuhkan radsync (dari prisma/route). */
export interface RadiusCustomerInput {
  username: string;
  status: string;
  staticIp?: string | null;
}
export interface RadiusProfileInput {
  rateLimitDown: number;
  rateLimitUp: number;
}

/** Perbarui radcheck+radreply untuk satu pelanggan (create/update). */
export async function syncCustomerRadius(
  tx: Prisma.TransactionClient,
  customer: RadiusCustomerInput,
  profile?: RadiusProfileInput | null,
  password?: string,
) {
  await syncCustomerRadiusRows(
    tx,
    customer,
    profile,
    password,
    customer.username,
  );
}

/**
 * Pindahkan semua baris RADIUS pelanggan ke username baru
 * (saat username diubah di aplikasi).
 */
export async function moveCustomerRadius(
  tx: Prisma.TransactionClient,
  oldUsername: string,
  newUsername: string,
) {
  await tx.radCheck.updateMany({
    where: { username: oldUsername },
    data: { username: newUsername },
  });
  await tx.radReply.updateMany({
    where: { username: oldUsername },
    data: { username: newUsername },
  });
}

/** Hapus baris RADIUS pelanggan (delete customer / nonaktif). */
export async function removeCustomerRadius(
  tx: Prisma.TransactionClient,
  username: string,
) {
  await tx.radCheck.deleteMany({ where: { username } });
  await tx.radReply.deleteMany({ where: { username } });
  await tx.radUserGroup.deleteMany({ where: { username } });
}

/** Implementasi bersama syncCustomerRadiusRows (pakai target username). */
async function syncCustomerRadiusRows(
  tx: Prisma.TransactionClient,
  customer: RadiusCustomerInput,
  profile?: RadiusProfileInput | null,
  password?: string,
  username?: string,
) {
  const u = username ?? customer.username;
  // Aktif → radcheck Cleartext-Password (suspend/disabled → hindari login)
  if (customer.status === "active" && password) {
    await tx.radCheck.upsert({
      where: {
        username_attribute: { username: u, attribute: "Cleartext-Password" },
      },
      update: { value: password, op: ":=" },
      create: {
        username: u,
        attribute: "Cleartext-Password",
        op: ":=",
        value: password,
      },
    });
  } else {
    await tx.radCheck.deleteMany({
      where: { username: u, attribute: "Cleartext-Password" },
    });
  }

  // radreply: Framed-IP-Address (static IP) — hapus bila kosong
  if (customer.staticIp) {
    await tx.radReply.upsert({
      where: {
        username_attribute: { username: u, attribute: "Framed-IP-Address" },
      },
      update: { value: customer.staticIp, op: ":=" },
      create: {
        username: u,
        attribute: "Framed-IP-Address",
        op: ":=",
        value: customer.staticIp,
      },
    });
  } else {
    await tx.radReply.deleteMany({
      where: { username: u, attribute: "Framed-IP-Address" },
    });
  }

  // radreply: Mikrotik-Rate-Limit dari profil (bila ada)
  if (profile) {
    const rate = rateLimitValue(profile.rateLimitDown, profile.rateLimitUp);
    await tx.radReply.upsert({
      where: {
        username_attribute: { username: u, attribute: "Mikrotik-Rate-Limit" },
      },
      update: { value: rate },
      create: {
        username: u,
        attribute: "Mikrotik-Rate-Limit",
        op: ":=",
        value: rate,
      },
    });
  } else {
    await tx.radReply.deleteMany({
      where: { username: u, attribute: "Mikrotik-Rate-Limit" },
    });
  }
}

/**
 * Perbarui Mikrotik-Rate-Limit semua pelanggan suatu profil
 * (saat rateLimit profil diubah).
 */
export async function syncProfileRadius(
  tx: Prisma.TransactionClient,
  profile: RadiusProfileInput,
  customerUsernames: string[],
) {
  if (customerUsernames.length === 0) return;
  const rate = rateLimitValue(profile.rateLimitDown, profile.rateLimitUp);
  await tx.radReply.updateMany({
    where: {
      username: { in: customerUsernames },
      attribute: "Mikrotik-Rate-Limit",
    },
    data: { value: rate },
  });
}

/** Upsert baris `nas` (RADIUS client) dari data router aplikasi. */
export async function syncRouterNas(
  tx: Prisma.TransactionClient,
  router: {
    ipAddress: string;
    name: string;
    location?: string | null;
    radiusSecret?: string | null;
  },
) {
  if (!router.radiusSecret) return;
  // nasname = IP router === asal request RADIUS (FreeRADIUS read_clients=nas)
  await tx.nas.upsert({
    where: { nasname: router.ipAddress },
    update: {
      shortname: router.name,
      type: "mikrotik",
      ports: 1812,
      secret: router.radiusSecret,
      description: router.location ?? null,
    },
    create: {
      nasname: router.ipAddress,
      shortname: router.name,
      type: "mikrotik",
      ports: 1812,
      secret: router.radiusSecret,
      description: router.location ?? null,
    },
  });
}

/** Hapus baris `nas` (saat router dihapus / radius diputus). */
export async function removeRouterNas(
  tx: Prisma.TransactionClient,
  ipAddress: string,
) {
  await tx.nas.deleteMany({ where: { nasname: ipAddress } });
}
