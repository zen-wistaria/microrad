/**
 * Sinkronisasi PPP Profile ke Router MikroTik via API Port 8728.
 * Menjamin sifat IDEMPOTENT saat tambah, edit (update/rename), maupun hapus.
 */
import { connectRouterOS, type MikrotikConn } from "./mikrotik-client";
import { prisma } from "./prisma";

export interface SyncPppProfileRouterParams {
  nasId: string;
  name: string;
  localAddress?: string | null;
  dnsServers?: string | null;
  parentQueue?: string | null;
  oldName?: string | null;
}

/**
 * Buat atau update PPP Profile di router MikroTik secara idempotent via API.
 */
export async function syncPppProfileToRouter(
  params: SyncPppProfileRouterParams,
): Promise<{ success: boolean; message: string }> {
  const router = await prisma.nasRouter.findUnique({
    where: { id: params.nasId },
  });

  if (!router || !router.apiUsername) {
    return {
      success: false,
      message: "Router NAS tidak memiliki kredensial API yang valid.",
    };
  }

  let conn: MikrotikConn | null = null;
  try {
    conn = await connectRouterOS({
      ipAddress: router.ipAddress,
      apiPort: router.apiPort,
      apiUsername: router.apiUsername,
      apiPassword: router.apiPassword,
    });

    const targetName = params.name.trim();
    const searchNames = new Set([targetName]);
    if (params.oldName && params.oldName.trim() !== targetName) {
      searchNames.add(params.oldName.trim());
    }

    // Cari entri profile di MikroTik
    const allProfiles = await conn.write("/ppp/profile/print");
    const existing = allProfiles.find((p) => p.name && searchNames.has(p.name));

    const commandParams: string[] = [`=name=${targetName}`];

    if (params.localAddress?.trim()) {
      commandParams.push(`=local-address=${params.localAddress.trim()}`);
    }
    if (params.dnsServers?.trim()) {
      commandParams.push(`=dns-server=${params.dnsServers.trim()}`);
    }
    if (params.parentQueue?.trim()) {
      commandParams.push(`=parent-queue=${params.parentQueue.trim()}`);
    }

    if (existing?.[".id"]) {
      // Update profile eksisting (idempotent)
      await conn.write("/ppp/profile/set", [
        `=.id=${existing[".id"]}`,
        ...commandParams,
      ]);
      return {
        success: true,
        message: `PPP Profile '${targetName}' berhasil diperbarui di router ${router.name}.`,
      };
    }

    // Tambah profile baru (idempotent)
    await conn.write("/ppp/profile/add", commandParams);
    return {
      success: true,
      message: `PPP Profile '${targetName}' berhasil dibuat di router ${router.name}.`,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[mikrotik-ppp-profile] Gagal sync profile '${params.name}' ke ${router.name} (${router.ipAddress}):`,
      errMsg,
    );
    return {
      success: false,
      message: `Gagal sync ke router ${router.name}: ${errMsg}`,
    };
  } finally {
    conn?.close();
  }
}

/**
 * Hapus PPP Profile dari router MikroTik secara idempotent via API.
 */
export async function removePppProfileFromRouter(
  nasId: string,
  profileName: string,
): Promise<{ success: boolean; message: string }> {
  const router = await prisma.nasRouter.findUnique({
    where: { id: nasId },
  });

  if (!router || !router.apiUsername) {
    return { success: false, message: "Router NAS tidak ditemukan." };
  }

  let conn: MikrotikConn | null = null;
  try {
    conn = await connectRouterOS({
      ipAddress: router.ipAddress,
      apiPort: router.apiPort,
      apiUsername: router.apiUsername,
      apiPassword: router.apiPassword,
    });

    const targetName = profileName.trim();
    const existing = await conn.write("/ppp/profile/print", [
      `?name=${targetName}`,
    ]);

    for (const p of existing) {
      if (p[".id"]) {
        await conn.write("/ppp/profile/remove", [`=.id=${p[".id"]}`]);
      }
    }

    return {
      success: true,
      message: `PPP Profile '${targetName}' berhasil dihapus dari router ${router.name}.`,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[mikrotik-ppp-profile] Gagal hapus profile '${profileName}' di ${router.name}:`,
      errMsg,
    );
    return {
      success: false,
      message: `Gagal menghapus dari router: ${errMsg}`,
    };
  } finally {
    conn?.close();
  }
}
