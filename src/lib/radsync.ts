/**
 * radsync — sinkronisasi data master aplikasi ke tabel RADIUS bersama
 * (radcheck / radreply / nas) yang dibaca FreeRADIUS v3.
 *
 * Semua fungsi menerima Prisma.TransactionClient agar dijalankan DALAM
 * transaksi yang sama dengan CRUD aplikasi (atomic).
 */
import type { Prisma } from "@/generated/prisma";
import {
  type BandwidthRateInput,
  formatBandwidthRateLimit,
} from "./radius-format";

/** Bentuk minimal data yang dibutuhkan radsync (dari prisma/route). */
export interface RadiusCustomerInput {
  username: string;
  status: string;
  staticIp?: string | null;
  bindOnNas?: boolean;
  nasIpAddress?: string | null;
  sessionMode?: "single" | "multi" | string;
  maxSimultaneous?: number;
  allowedNasIps?: string[];
  poolName?: string | null;
}
export interface RadiusProfileInput {
  name?: string;
  // Dukungan data baru BandwidthRateInput
  bandwidth?: BandwidthRateInput | null;
  priority?: number | null;
  dnsServers?: string | null;
  poolName?: string | null;
  // Backward compatibility fields
  rateLimitDown?: number;
  rateLimitUp?: number;
  burstLimitDown?: number | null;
  burstLimitUp?: number | null;
  burstThresholdDown?: number | null;
  burstThresholdUp?: number | null;
  burstTimeSeconds?: number | null;
  limitAtDown?: number | null;
  limitAtUp?: number | null;
}

/** Wajib dipakai pemanggil agar bind-on NAS ikut tersinkron. Router IP diambil
 *  terpisah bila tidak disertakan. */
export async function syncCustomerRadius(
  tx: Prisma.TransactionClient,
  customer: RadiusCustomerInput,
  profile?: RadiusProfileInput | null,
  password?: string,
  nasIpAddress?: string | null,
) {
  await syncCustomerRadiusRows(
    tx,
    customer,
    profile,
    password,
    customer.username,
    nasIpAddress,
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
  await tx.radUserGroup.updateMany({
    where: { username: oldUsername },
    data: { username: newUsername },
  });
  await tx.radNasAllow.updateMany({
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
  await tx.radNasAllow.deleteMany({ where: { username } });
}

/** Implementasi bersama syncCustomerRadiusRows (pakai target username). */
async function syncCustomerRadiusRows(
  tx: Prisma.TransactionClient,
  customer: RadiusCustomerInput,
  profile?: RadiusProfileInput | null,
  password?: string,
  username?: string,
  nasIpAddress?: string | null,
) {
  const u = username ?? customer.username;
  const bindNasIp = nasIpAddress ?? customer.nasIpAddress ?? null;
  // Aktif → radcheck Cleartext-Password (suspend/disabled → hindari login).
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
  } else if (customer.status === "active" && !password) {
    // Aktif tanpa argumen password — pertahankan baris Cleartext-Password
  }

  // Non-aktif (suspend/disabled): tolak login lewat Auth-Type := Reject
  if (customer.status !== "active") {
    await tx.radCheck.upsert({
      where: {
        username_attribute: {
          username: u,
          attribute: "Auth-Type",
        },
      },
      update: { value: "Reject", op: ":=" },
      create: {
        username: u,
        attribute: "Auth-Type",
        op: ":=",
        value: "Reject",
      },
    });
  } else {
    // Aktif kembali → hapus rule penolakan
    await tx.radCheck.deleteMany({
      where: { username: u, attribute: "Auth-Type" },
    });
  }

  // ── Session Control (Simultaneous-Use) ──
  const simultaneousCount =
    customer.sessionMode === "multi"
      ? String(Math.max(customer.maxSimultaneous || 2, 1))
      : "1";
  await tx.radCheck.upsert({
    where: {
      username_attribute: { username: u, attribute: "Simultaneous-Use" },
    },
    update: { value: simultaneousCount, op: ":=" },
    create: {
      username: u,
      attribute: "Simultaneous-Use",
      op: ":=",
      value: simultaneousCount,
    },
  });

  // ── NAS Binding Whitelist (radnasallow) ──
  await tx.radNasAllow.deleteMany({
    where: { username: u },
  });

  const targetNasIps: string[] = [];
  if (customer.bindOnNas) {
    if (customer.allowedNasIps && customer.allowedNasIps.length > 0) {
      targetNasIps.push(...customer.allowedNasIps.filter(Boolean));
    } else if (bindNasIp) {
      targetNasIps.push(bindNasIp);
    }
  }

  if (targetNasIps.length > 0) {
    const uniqueIps = Array.from(new Set(targetNasIps));
    await tx.radNasAllow.createMany({
      data: uniqueIps.map((ip) => ({
        username: u,
        nasIpAddress: ip,
      })),
      skipDuplicates: true,
    });
  }

  // Bersihkan legacy NAS-IP-Address dari radcheck jika ada
  await tx.radCheck.deleteMany({
    where: { username: u, attribute: "NAS-IP-Address" },
  });

  // ── radusergroup & radreply ──
  // radreply: Framed-IP-Address (HANYA untuk static IP per pelanggan)
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

  // Bersihkan atribut redundant dari radreply agar menggunakan Group Attributes (radgroupreply)
  await tx.radReply.deleteMany({
    where: {
      username: u,
      attribute: {
        in: [
          "Mikrotik-Rate-Limit",
          "Mikrotik-Group",
          "MS-Primary-DNS-Server",
          "MS-Secondary-DNS-Server",
          "Session-Timeout",
          "Idle-Timeout",
          "Framed-Pool",
        ],
      },
    },
  });

  // Hubungkan user ke group di radusergroup
  if (profile) {
    let groupName = "";
    if (profile.bandwidth) {
      // Jika profile adalah InternetProfile, gunakan nama grupnya
      groupName = (profile as { name?: string }).name?.trim() || "";
    }

    if (groupName) {
      await tx.radUserGroup.deleteMany({ where: { username: u } });
      await tx.radUserGroup.create({
        data: {
          username: u,
          groupname: groupName,
          priority: 1,
        },
      });
    }
  }
}

/**
 * Sinkronisasi Group Reply attributes (radgroupreply) untuk suatu Paket Internet (InternetProfile)
 */
export async function syncInternetProfileRadiusBulk(
  tx: Prisma.TransactionClient,
  profileId: string,
) {
  const profile = await tx.internetProfile.findUnique({
    where: { id: profileId },
    include: { bandwidth: true },
  });
  if (!profile || !profile.bandwidth) return;

  const groupName = profile.name.trim();
  const rate = formatBandwidthRateLimit(profile.bandwidth, profile.priority);

  // Hapus baris lama di radgroupreply untuk groupName ini
  await tx.radGroupReply.deleteMany({
    where: {
      groupname: groupName,
      attribute: { in: ["Mikrotik-Rate-Limit", "Mikrotik-Group"] },
    },
  });

  // Tambahkan attribute group reply baru
  await tx.radGroupReply.createMany({
    data: [
      {
        groupname: groupName,
        attribute: "Mikrotik-Rate-Limit",
        op: ":=",
        value: rate,
      },
      {
        groupname: groupName,
        attribute: "Mikrotik-Group",
        op: ":=",
        value: groupName,
      },
    ],
  });

  // Update radusergroup untuk semua pelanggan yang menggunakan profile ini
  const customers = await tx.customer.findMany({
    where: { profileId },
    select: { username: true },
  });

  if (customers.length > 0) {
    const usernames = customers.map((c) => c.username);
    await tx.radUserGroup.deleteMany({
      where: { username: { in: usernames } },
    });
    await tx.radUserGroup.createMany({
      data: usernames.map((un) => ({
        username: un,
        groupname: groupName,
        priority: 1,
      })),
    });
  }
}

export const syncPppProfileRadiusBulk = syncInternetProfileRadiusBulk;

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

export function ipToLong(ip: string): number {
  const parts = ip.trim().split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
  ) {
    return 0;
  }
  return (
    ((parts[0] << 24) >>> 0) +
    ((parts[1] << 16) >>> 0) +
    ((parts[2] << 8) >>> 0) +
    (parts[3] >>> 0)
  );
}

export function longToIp(num: number): string {
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join(".");
}

/**
 * Sinkronisasi daftar IP di tabel `radippool` dari konfigurasi PPP Profile (ipModule = 'sql').
 * Menambah range IP baru dan membersihkan IP lama / pool lama yang berganti nama.
 */
export async function syncPppProfileIpPool(
  tx: Prisma.TransactionClient,
  profileId: string,
  oldName?: string | null,
) {
  const profile = await tx.pppProfile.findUnique({
    where: { id: profileId },
  });
  if (!profile) return;

  const poolName = profile.name.trim();

  // Jika nama profile berubah, bersihkan pool dengan nama lama di radippool
  if (oldName && oldName.trim() !== poolName) {
    await tx.radIpPool.deleteMany({
      where: { poolName: oldName.trim() },
    });
  }

  if (
    profile.ipModule !== "sql" ||
    !profile.rangeIpStart ||
    !profile.rangeIpEnd
  ) {
    // Jika diubah ke mikrotik_pool / non-sql, bersihkan IP pool tersebut
    await tx.radIpPool.deleteMany({
      where: { poolName },
    });
    return;
  }

  const startNum = ipToLong(profile.rangeIpStart);
  const endNum = ipToLong(profile.rangeIpEnd);
  if (startNum === 0 || endNum === 0 || startNum > endNum) return;

  // Batasi maksimal 1024 IP per pool untuk mencegah beban query ekstrem
  const safeEndNum = Math.min(endNum, startNum + 1023);

  const targetIps = new Set<string>();
  for (let i = startNum; i <= safeEndNum; i++) {
    targetIps.add(longToIp(i));
  }

  // Ambil IP yang sudah ada di tabel radippool untuk poolName ini
  const existingRows = await tx.radIpPool.findMany({
    where: { poolName },
    select: { id: true, framedIpAddress: true },
  });

  const existingIpMap = new Map(
    existingRows.map((r) => [r.framedIpAddress, r]),
  );

  // Hapus IP lama yang tidak termasuk dalam range baru
  const toDeleteIds: number[] = [];
  for (const row of existingRows) {
    if (!targetIps.has(row.framedIpAddress)) {
      toDeleteIds.push(row.id);
    }
  }
  if (toDeleteIds.length > 0) {
    await tx.radIpPool.deleteMany({
      where: { id: { in: toDeleteIds } },
    });
  }

  // Tambahkan IP baru yang belum ada di pool
  const toInsertData: { poolName: string; framedIpAddress: string }[] = [];
  for (const ip of targetIps) {
    if (!existingIpMap.has(ip)) {
      toInsertData.push({
        poolName,
        framedIpAddress: ip,
      });
    }
  }

  if (toInsertData.length > 0) {
    await tx.radIpPool.createMany({
      data: toInsertData,
      skipDuplicates: true,
    });
  }
}

/** Hapus seluruh baris pool saat PPP profile dihapus. */
export async function cleanupPppProfileIpPool(
  tx: Prisma.TransactionClient,
  poolName: string,
) {
  await tx.radIpPool.deleteMany({
    where: { poolName: poolName.trim() },
  });
}

/**
 * Sinkronisasi massal seluruh pelanggan di suatu Area Group saat
 * Profile atau Router NAS dibuat, diupdate, atau dihapus.
 */
export async function syncAreaGroupRadiusBulk(
  tx: Prisma.TransactionClient,
  areaGroupId: string,
) {
  const group = await tx.areaGroup.findUnique({
    where: { id: areaGroupId },
    include: {
      routers: true,
      pppProfiles: true,
    },
  });
  if (!group) return;

  const customers = await tx.customer.findMany({
    where: { areaGroupId },
    select: { username: true, bindOnNas: true, allowedNasIps: true },
  });

  if (customers.length === 0) return;

  const routerIps = group.routers.map((r) => r.ipAddress).filter(Boolean);

  // Update radnasallow untuk seluruh pelanggan yang bindOnNas di area ini
  for (const c of customers) {
    if (c.bindOnNas) {
      await tx.radNasAllow.deleteMany({ where: { username: c.username } });
      const targetIps = c.allowedNasIps?.length ? c.allowedNasIps : routerIps;
      if (targetIps.length > 0) {
        await tx.radNasAllow.createMany({
          data: targetIps.map((ip) => ({
            username: c.username,
            nasIpAddress: ip,
          })),
          skipDuplicates: true,
        });
      }
    }
  }
}

// Backward compatibility alias
export const syncProfileGroupRadiusBulk = syncAreaGroupRadiusBulk;
