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
  rateLimitValue,
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

  // radreply: Framed-IP-Address (static IP) vs Framed-Pool (Dynamic SQL IP Pool)
  const poolToAssign = customer.poolName || profile?.poolName;
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
    await tx.radReply.deleteMany({
      where: { username: u, attribute: "Framed-Pool" },
    });
  } else {
    await tx.radReply.deleteMany({
      where: { username: u, attribute: "Framed-IP-Address" },
    });
    if (poolToAssign) {
      await tx.radReply.upsert({
        where: {
          username_attribute: { username: u, attribute: "Framed-Pool" },
        },
        update: { value: poolToAssign, op: ":=" },
        create: {
          username: u,
          attribute: "Framed-Pool",
          op: ":=",
          value: poolToAssign,
        },
      });
      await tx.radReply.upsert({
        where: {
          username_attribute: { username: u, attribute: "Mikrotik-Group" },
        },
        update: { value: poolToAssign, op: ":=" },
        create: {
          username: u,
          attribute: "Mikrotik-Group",
          op: ":=",
          value: poolToAssign,
        },
      });
    } else {
      await tx.radReply.deleteMany({
        where: {
          username: u,
          attribute: { in: ["Framed-Pool", "Mikrotik-Group"] },
        },
      });
    }
  }

  // radreply: Mikrotik-Rate-Limit dari profil
  if (profile) {
    let rate = "";
    if (profile.bandwidth) {
      rate = formatBandwidthRateLimit(profile.bandwidth, profile.priority ?? 8);
    } else if (profile.rateLimitDown && profile.rateLimitUp) {
      rate = rateLimitValue({
        maxDownload: `${profile.rateLimitDown}M`,
        maxUpload: `${profile.rateLimitUp}M`,
        burstDownload: profile.burstLimitDown
          ? `${profile.burstLimitDown}k`
          : undefined,
        burstUpload: profile.burstLimitUp
          ? `${profile.burstLimitUp}k`
          : undefined,
        burstThresholdDownload: profile.burstThresholdDown
          ? `${profile.burstThresholdDown}k`
          : undefined,
        burstThresholdUp: profile.burstThresholdUp
          ? `${profile.burstThresholdUp}k`
          : undefined,
        burstTimeSeconds: profile.burstTimeSeconds ?? undefined,
        priority: profile.priority ?? undefined,
        limitAtDownload: profile.limitAtDown
          ? `${profile.limitAtDown}k`
          : undefined,
        limitAtUp: profile.limitAtUp ? `${profile.limitAtUp}k` : undefined,
      });
    }

    if (rate) {
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

    // DNS Server reply attributes
    if (profile.dnsServers) {
      const dnsParts = profile.dnsServers
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (dnsParts[0]) {
        await tx.radReply.upsert({
          where: {
            username_attribute: {
              username: u,
              attribute: "MS-Primary-DNS-Server",
            },
          },
          update: { value: dnsParts[0], op: ":=" },
          create: {
            username: u,
            attribute: "MS-Primary-DNS-Server",
            op: ":=",
            value: dnsParts[0],
          },
        });
      }
      if (dnsParts[1]) {
        await tx.radReply.upsert({
          where: {
            username_attribute: {
              username: u,
              attribute: "MS-Secondary-DNS-Server",
            },
          },
          update: { value: dnsParts[1], op: ":=" },
          create: {
            username: u,
            attribute: "MS-Secondary-DNS-Server",
            op: ":=",
            value: dnsParts[1],
          },
        });
      }
    }
  } else {
    await tx.radReply.deleteMany({
      where: {
        username: u,
        attribute: {
          in: [
            "Mikrotik-Rate-Limit",
            "MS-Primary-DNS-Server",
            "MS-Secondary-DNS-Server",
          ],
        },
      },
    });
  }
}

/**
 * Perbarui Mikrotik-Rate-Limit semua pelanggan suatu profil Internet
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

  const customers = await tx.customer.findMany({
    where: { profileId },
    select: { username: true },
  });
  if (customers.length === 0) return;

  const usernames = customers.map((c) => c.username);
  const rate = formatBandwidthRateLimit(profile.bandwidth, profile.priority);

  await tx.radReply.updateMany({
    where: {
      username: { in: usernames },
      attribute: "Mikrotik-Rate-Limit",
    },
    data: { value: rate },
  });
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
 * Sinkronisasi massal seluruh pelanggan dinamis di suatu Profile Group saat
 * PPP Profile (Node Router / Pool Name / DNS) dibuat, diupdate, atau dihapus.
 */
export async function syncProfileGroupRadiusBulk(
  tx: Prisma.TransactionClient,
  profileGroupId: string,
) {
  const group = await tx.profileGroup.findUnique({
    where: { id: profileGroupId },
    include: { pppProfiles: true },
  });
  if (!group) return;

  const sqlNode =
    group.pppProfiles.find((p) => p.ipModule === "sql") ?? group.pppProfiles[0];
  const poolName = sqlNode?.name?.trim() || null;

  // Ambil seluruh pelanggan di group ini yang menggunakan IP dinamis (non-statis)
  const customers = await tx.customer.findMany({
    where: { profileGroupId, staticIp: null },
    select: { username: true },
  });

  if (customers.length === 0) return;

  const usernames = customers.map((c) => c.username);

  if (poolName) {
    for (const u of usernames) {
      await tx.radReply.upsert({
        where: {
          username_attribute: { username: u, attribute: "Framed-Pool" },
        },
        update: { value: poolName, op: ":=" },
        create: {
          username: u,
          attribute: "Framed-Pool",
          op: ":=",
          value: poolName,
        },
      });
      await tx.radReply.upsert({
        where: {
          username_attribute: { username: u, attribute: "Mikrotik-Group" },
        },
        update: { value: poolName, op: ":=" },
        create: {
          username: u,
          attribute: "Mikrotik-Group",
          op: ":=",
          value: poolName,
        },
      });

      if (sqlNode?.dnsServers) {
        const dnsParts = sqlNode.dnsServers
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (dnsParts[0]) {
          await tx.radReply.upsert({
            where: {
              username_attribute: {
                username: u,
                attribute: "MS-Primary-DNS-Server",
              },
            },
            update: { value: dnsParts[0], op: ":=" },
            create: {
              username: u,
              attribute: "MS-Primary-DNS-Server",
              op: ":=",
              value: dnsParts[0],
            },
          });
        }
        if (dnsParts[1]) {
          await tx.radReply.upsert({
            where: {
              username_attribute: {
                username: u,
                attribute: "MS-Secondary-DNS-Server",
              },
            },
            update: { value: dnsParts[1], op: ":=" },
            create: {
              username: u,
              attribute: "MS-Secondary-DNS-Server",
              op: ":=",
              value: dnsParts[1],
            },
          });
        }
      }
    }
  } else {
    await tx.radReply.deleteMany({
      where: {
        username: { in: usernames },
        attribute: { in: ["Framed-Pool", "Mikrotik-Group"] },
      },
    });
  }
}
