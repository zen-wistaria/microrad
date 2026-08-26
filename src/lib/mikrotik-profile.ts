/**
 * Sinkronisasi Profil (PPP & Hotspot) ke Router MikroTik via API Port 8728.
 * Menjamin sifat IDEMPOTENT saat tambah, edit (update/rename), maupun hapus.
 */
import { connectRouterOS, type MikrotikConn } from "./mikrotik-client";
import { prisma } from "./prisma";

export interface SyncProfileRouterParams {
  nasId: string;
  name: string;
  serviceType?: "PPP" | "HOTSPOT" | string;
  ipModule?: "sql" | "mikrotik_pool" | string;
  localAddress?: string | null;
  rangeIpStart?: string | null;
  rangeIpEnd?: string | null;
  dnsServers?: string | null;
  parentQueue?: string | null;
  sessionTimeout?: number | null;
  idleTimeout?: number | null;
  insertQueueBefore?: string | null;
  keepaliveTimeout?: string | null;
  addMacCookie?: boolean;
  macCookieTimeout?: string | null;
  oldName?: string | null;
}

// Backward compatibility interface
export type SyncPppProfileRouterParams = SyncProfileRouterParams;

/**
 * Buat atau update IP Pool di router MikroTik jika ipModule === "mikrotik_pool".
 */
async function syncMikrotikIpPool(
  conn: MikrotikConn,
  poolName: string,
  rangeStart?: string | null,
  rangeEnd?: string | null,
  oldName?: string | null,
) {
  if (!rangeStart || !rangeEnd) return;
  const targetRanges = `${rangeStart.trim()}-${rangeEnd.trim()}`;

  const searchNames = new Set([poolName]);
  if (oldName && oldName.trim() !== poolName) {
    searchNames.add(oldName.trim());
  }

  const allPools = await conn.write("/ip/pool/print");
  const existing = allPools.find((p) => p.name && searchNames.has(p.name));

  if (existing?.[".id"]) {
    await conn.write("/ip/pool/set", [
      `=.id=${existing[".id"]}`,
      `=name=${poolName}`,
      `=ranges=${targetRanges}`,
      `=comment=Managed by MicroRAD: ${poolName}`,
    ]);
  } else {
    await conn.write("/ip/pool/add", [
      `=name=${poolName}`,
      `=ranges=${targetRanges}`,
      `=comment=Managed by MicroRAD: ${poolName}`,
    ]);
  }
}

/**
 * Buat atau update Profile (PPP atau Hotspot) di router MikroTik secara idempotent via API.
 */
export async function syncProfileToRouter(
  params: SyncProfileRouterParams,
): Promise<{ success: boolean; message: string }> {
  const router = await prisma.nasRouter.findUnique({
    where: { id: params.nasId },
  });

  if (!router || !router.apiUsername) {
    return {
      success: false,
      message: `Router NAS '${params.nasId}' tidak memiliki kredensial API yang valid.`,
    };
  }

  // Skip router yang sedang offline
  if (router.status === "offline") {
    return {
      success: false,
      message: `Router '${router.name}' (${router.ipAddress}) sedang offline, sinkronisasi dilewati.`,
    };
  }

  let conn: MikrotikConn | null = null;
  try {
    // Timeout 10 detik agar tidak stuck
    conn = await connectRouterOS(
      {
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername: router.apiUsername,
        apiPassword: router.apiPassword,
      },
      10_000,
    );

    const targetName = params.name.trim();
    const serviceType = (params.serviceType || "PPP").toUpperCase();
    const isHotspot = serviceType === "HOTSPOT";

    // 1. Jika ipModule adalah mikrotik_pool, buat/update /ip/pool di router.
    // Jika sql, bersihkan pool lokal router jika sebelumnya ada.
    if (params.ipModule === "mikrotik_pool") {
      await syncMikrotikIpPool(
        conn,
        targetName,
        params.rangeIpStart,
        params.rangeIpEnd,
        params.oldName,
      );
    } else {
      const existingPools = await conn.write("/ip/pool/print", [
        `?name=${targetName}`,
      ]);
      for (const pool of existingPools) {
        if (pool[".id"]) {
          await conn.write("/ip/pool/remove", [`=.id=${pool[".id"]}`]);
        }
      }
      if (params.oldName && params.oldName.trim() !== targetName) {
        const oldPools = await conn.write("/ip/pool/print", [
          `?name=${params.oldName.trim()}`,
        ]);
        for (const pool of oldPools) {
          if (pool[".id"]) {
            await conn.write("/ip/pool/remove", [`=.id=${pool[".id"]}`]);
          }
        }
      }
    }

    const searchNames = new Set([targetName]);
    if (params.oldName && params.oldName.trim() !== targetName) {
      searchNames.add(params.oldName.trim());
    }

    if (isHotspot) {
      // ── Hotspot User Profile (/ip/hotspot/user/profile) ──
      const allHotspotProfiles = await conn.write(
        "/ip/hotspot/user/profile/print",
      );
      const existing = allHotspotProfiles.find(
        (p) => p.name && searchNames.has(p.name),
      );

      const commandParams: string[] = [`=name=${targetName}`];

      if (params.ipModule === "mikrotik_pool") {
        commandParams.push(`=address-pool=${targetName}`);
      } else {
        commandParams.push("=address-pool=none");
      }

      if (params.parentQueue?.trim()) {
        commandParams.push(`=parent-queue=${params.parentQueue.trim()}`);
        if (params.insertQueueBefore?.trim()) {
          const iqb = params.insertQueueBefore.trim().toLowerCase();
          if (iqb === "first" || iqb === "bottom") {
            commandParams.push(`=insert-queue-before=${iqb}`);
          }
        }
      }

      if (params.keepaliveTimeout?.trim()) {
        commandParams.push(
          `=keepalive-timeout=${params.keepaliveTimeout.trim()}`,
        );
      }

      if (typeof params.addMacCookie === "boolean") {
        commandParams.push(
          `=add-mac-cookie=${params.addMacCookie ? "yes" : "no"}`,
        );
        if (params.addMacCookie && params.macCookieTimeout?.trim()) {
          commandParams.push(
            `=mac-cookie-timeout=${params.macCookieTimeout.trim()}`,
          );
        }
      }

      if (params.sessionTimeout && params.sessionTimeout > 0) {
        commandParams.push(`=session-timeout=${params.sessionTimeout}s`);
      } else if (existing?.[".id"]) {
        commandParams.push("=session-timeout=0s");
      }

      if (params.idleTimeout && params.idleTimeout > 0) {
        commandParams.push(`=idle-timeout=${params.idleTimeout}s`);
      } else if (existing?.[".id"]) {
        commandParams.push("=idle-timeout=0s");
      }

      if (existing?.[".id"]) {
        if (!params.parentQueue?.trim() && existing["parent-queue"]) {
          try {
            await conn.write("/ip/hotspot/user/profile/unset", [
              `=.id=${existing[".id"]}`,
              "=value-name=parent-queue",
            ]);
            await conn.write("/ip/hotspot/user/profile/unset", [
              `=.id=${existing[".id"]}`,
              "=value-name=insert-queue-before",
            ]);
          } catch {}
        } else if (
          params.parentQueue?.trim() &&
          existing["insert-queue-before"] &&
          (!params.insertQueueBefore?.trim() ||
            params.insertQueueBefore.trim().toLowerCase() === "none")
        ) {
          try {
            await conn.write("/ip/hotspot/user/profile/unset", [
              `=.id=${existing[".id"]}`,
              "=value-name=insert-queue-before",
            ]);
          } catch {}
        }

        await conn.write("/ip/hotspot/user/profile/set", [
          `=.id=${existing[".id"]}`,
          ...commandParams,
        ]);
        return {
          success: true,
          message: `Hotspot Profile '${targetName}' berhasil diperbarui di router ${router.name}.`,
        };
      }

      await conn.write("/ip/hotspot/user/profile/add", commandParams);
      return {
        success: true,
        message: `Hotspot Profile '${targetName}' berhasil dibuat di router ${router.name}.`,
      };
    }

    // ── PPP Profile (/ppp/profile) ──
    const allProfiles = await conn.write("/ppp/profile/print");
    const existing = allProfiles.find((p) => p.name && searchNames.has(p.name));

    const commandParams: string[] = [
      `=name=${targetName}`,
      `=comment=Managed by MicroRAD: ${targetName}`,
    ];

    if (params.localAddress?.trim()) {
      commandParams.push(`=local-address=${params.localAddress.trim()}`);
    }

    if (params.dnsServers?.trim()) {
      commandParams.push(`=dns-server=${params.dnsServers.trim()}`);
    } else if (existing?.[".id"]) {
      commandParams.push("=dns-server=");
    }

    // Remote address hanya dikirim jika menggunakan mikrotik_pool.
    // Pada mode SQL, remote-address di router MikroTik wajib dibiarkan kosong (unset).
    if (params.ipModule === "mikrotik_pool") {
      commandParams.push(`=remote-address=${targetName}`);
    }

    if (params.parentQueue?.trim()) {
      commandParams.push(`=parent-queue=${params.parentQueue.trim()}`);
      if (params.insertQueueBefore?.trim()) {
        const iqb = params.insertQueueBefore.trim().toLowerCase();
        if (iqb === "first" || iqb === "bottom") {
          commandParams.push(`=insert-queue-before=${iqb}`);
        }
      }
    }

    if (params.sessionTimeout && params.sessionTimeout > 0) {
      commandParams.push(`=session-timeout=${params.sessionTimeout}s`);
    } else if (existing?.[".id"]) {
      commandParams.push("=session-timeout=0s");
    }

    if (params.idleTimeout && params.idleTimeout > 0) {
      commandParams.push(`=idle-timeout=${params.idleTimeout}s`);
    } else if (existing?.[".id"]) {
      commandParams.push("=idle-timeout=0s");
    }

    if (existing?.[".id"]) {
      // Jika parent-queue dikosongkan pada form tapi ada di router sebelumnya, unset parent-queue & insert-queue-before
      if (!params.parentQueue?.trim() && existing["parent-queue"]) {
        try {
          await conn.write("/ppp/profile/unset", [
            `=.id=${existing[".id"]}`,
            "=value-name=parent-queue",
          ]);
          await conn.write("/ppp/profile/unset", [
            `=.id=${existing[".id"]}`,
            "=value-name=insert-queue-before",
          ]);
        } catch {}
      } else if (
        params.parentQueue?.trim() &&
        existing["insert-queue-before"] &&
        (!params.insertQueueBefore?.trim() ||
          params.insertQueueBefore.trim().toLowerCase() === "none")
      ) {
        try {
          await conn.write("/ppp/profile/unset", [
            `=.id=${existing[".id"]}`,
            "=value-name=insert-queue-before",
          ]);
        } catch {}
      }

      // Jika sebelumnya ada remote-address di router dan sekarang beralih ke SQL, unset remote-address
      if (params.ipModule !== "mikrotik_pool" && existing["remote-address"]) {
        try {
          await conn.write("/ppp/profile/unset", [
            `=.id=${existing[".id"]}`,
            "=value-name=remote-address",
          ]);
        } catch {
          // Fallback / abaikan jika sudah unset
        }
      }

      await conn.write("/ppp/profile/set", [
        `=.id=${existing[".id"]}`,
        ...commandParams,
      ]);
      return {
        success: true,
        message: `PPP Profile '${targetName}' berhasil diperbarui di router ${router.name}.`,
      };
    }

    await conn.write("/ppp/profile/add", commandParams);
    return {
      success: true,
      message: `PPP Profile '${targetName}' berhasil dibuat di router ${router.name}.`,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[mikrotik-profile] Gagal sync profile '${params.name}' ke ${router.name} (${router.ipAddress}):`,
      errMsg,
    );
    return {
      success: false,
      message: `Gagal sync ke router ${router.name} (${router.ipAddress}): ${errMsg}`,
    };
  } finally {
    conn?.close();
  }
}

// Alias for backward compatibility
export const syncPppProfileToRouter = syncProfileToRouter;

/**
 * Hapus Profile dari router MikroTik secara idempotent via API.
 */
export async function removeProfileFromRouter(
  nasId: string,
  profileName: string,
  serviceType: "PPP" | "HOTSPOT" | string = "PPP",
): Promise<{ success: boolean; message: string }> {
  const router = await prisma.nasRouter.findUnique({
    where: { id: nasId },
  });

  if (!router || !router.apiUsername) {
    return { success: false, message: "Router NAS tidak ditemukan." };
  }

  // Skip router yang sedang offline
  if (router.status === "offline") {
    return {
      success: false,
      message: `Router '${router.name}' (${router.ipAddress}) sedang offline, penghapusan dilewati.`,
    };
  }

  let conn: MikrotikConn | null = null;
  try {
    // Timeout 10 detik agar tidak stuck
    conn = await connectRouterOS(
      {
        ipAddress: router.ipAddress,
        apiPort: router.apiPort,
        apiUsername: router.apiUsername,
        apiPassword: router.apiPassword,
      },
      10_000,
    );

    const targetName = profileName.trim();
    const isHotspot = (serviceType || "PPP").toUpperCase() === "HOTSPOT";

    if (isHotspot) {
      const existing = await conn.write("/ip/hotspot/user/profile/print", [
        `?name=${targetName}`,
      ]);
      for (const p of existing) {
        if (p[".id"]) {
          await conn.write("/ip/hotspot/user/profile/remove", [
            `=.id=${p[".id"]}`,
          ]);
        }
      }
    } else {
      const existing = await conn.write("/ppp/profile/print", [
        `?name=${targetName}`,
      ]);
      for (const p of existing) {
        if (p[".id"]) {
          await conn.write("/ppp/profile/remove", [`=.id=${p[".id"]}`]);
        }
      }
    }

    // Hapus juga /ip/pool jika ada
    const existingPools = await conn.write("/ip/pool/print", [
      `?name=${targetName}`,
    ]);
    for (const pool of existingPools) {
      if (pool[".id"]) {
        await conn.write("/ip/pool/remove", [`=.id=${pool[".id"]}`]);
      }
    }

    return {
      success: true,
      message: `Profile '${targetName}' berhasil dihapus dari router ${router.name}.`,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[mikrotik-profile] Gagal hapus profile '${profileName}' di ${router.name}:`,
      errMsg,
    );
    return {
      success: false,
      message: `Gagal menghapus dari router ${router.name}: ${errMsg}`,
    };
  } finally {
    conn?.close();
  }
}

// Alias for backward compatibility
export const removePppProfileFromRouter = removeProfileFromRouter;

/**
 * Sinkronkan 1 profil ke seluruh router NAS yang tergabung dalam Area Group profil tersebut.
 */
export async function syncSingleProfileToRouters(
  profileId: string,
  oldName?: string | null,
): Promise<{ totalRouters: number; results: string[] }> {
  const profile = await prisma.pppProfile.findUnique({
    where: { id: profileId },
    include: {
      areaGroup: {
        include: {
          routers: true,
        },
      },
    },
  });

  if (
    !profile ||
    !profile.areaGroup ||
    profile.areaGroup.routers.length === 0
  ) {
    return {
      totalRouters: 0,
      results: [
        "Profil tidak terhubung ke Wilayah (Area Group) atau wilayah belum memiliki router NAS.",
      ],
    };
  }

  const results: string[] = [];

  for (const router of profile.areaGroup.routers) {
    if (router.status === "offline") {
      results.push(
        `Router '${router.name}' (${router.ipAddress}) offline, sinkronisasi dilewati.`,
      );
      continue;
    }

    const res = await syncProfileToRouter({
      nasId: router.id,
      name: profile.name,
      serviceType: profile.serviceType || profile.areaGroup.serviceType,
      ipModule: profile.ipModule,
      localAddress: profile.localAddress,
      rangeIpStart: profile.rangeIpStart,
      rangeIpEnd: profile.rangeIpEnd,
      dnsServers: profile.dnsServers,
      parentQueue: profile.parentQueue,
      sessionTimeout: profile.sessionTimeout,
      idleTimeout: profile.idleTimeout,
      insertQueueBefore: profile.insertQueueBefore,
      keepaliveTimeout: profile.keepaliveTimeout,
      addMacCookie: profile.addMacCookie,
      macCookieTimeout: profile.macCookieTimeout,
      oldName: oldName ?? null,
    });
    results.push(res.message);
  }

  return {
    totalRouters: profile.areaGroup.routers.length,
    results,
  };
}

/**
 * Sinkronkan seluruh profil di suatu Area Group ke semua router NAS yang tergabung dalam Area tersebut.
 */
export async function syncAreaGroupToRouters(
  areaGroupId: string,
): Promise<{ totalRouters: number; totalProfiles: number; results: string[] }> {
  const area = await prisma.areaGroup.findUnique({
    where: { id: areaGroupId },
    include: {
      routers: true,
      pppProfiles: true,
    },
  });

  if (!area || area.routers.length === 0) {
    return {
      totalRouters: 0,
      totalProfiles: area?.pppProfiles.length || 0,
      results: ["Tidak ada router yang terhubung pada Area ini."],
    };
  }

  const results: string[] = [];

  for (const router of area.routers) {
    if (router.status === "offline") {
      results.push(
        `Router '${router.name}' (${router.ipAddress}) offline, sinkronisasi dilewati.`,
      );
      continue;
    }

    for (const profile of area.pppProfiles) {
      const res = await syncProfileToRouter({
        nasId: router.id,
        name: profile.name,
        serviceType: profile.serviceType || area.serviceType,
        ipModule: profile.ipModule,
        localAddress: profile.localAddress,
        rangeIpStart: profile.rangeIpStart,
        rangeIpEnd: profile.rangeIpEnd,
        dnsServers: profile.dnsServers,
        parentQueue: profile.parentQueue,
        sessionTimeout: profile.sessionTimeout,
        idleTimeout: profile.idleTimeout,
        insertQueueBefore: profile.insertQueueBefore,
        keepaliveTimeout: profile.keepaliveTimeout,
        addMacCookie: profile.addMacCookie,
        macCookieTimeout: profile.macCookieTimeout,
      });
      results.push(res.message);
    }
  }

  return {
    totalRouters: area.routers.length,
    totalProfiles: area.pppProfiles.length,
    results,
  };
}
