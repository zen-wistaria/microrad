/**
 * Kick sesi PPPoE aktif dari RouterOS via API (best-effort).
 * Dipakai route sessions POST & customer detail disconnect — sesi dibaca
 * dari radacct; fungsi ini hanya melepas koneksi di router agar
 * FreeRADIUS menerima Accounting-Stop.
 */
import { connectRouterOS } from "./mikrotik-client";
import { prisma } from "./prisma";

export async function kickSessionByUsername(
  customerUsername: string,
  routerId?: string | null,
): Promise<{ kicked: boolean; message?: string }> {
  if (!customerUsername) {
    return { kicked: false, message: "Username kosong." };
  }
  try {
    // 1. Cek apakah ada sesi aktif di radacct
    const activeAcct = await prisma.radAcct.findFirst({
      where: { username: customerUsername, acctStopTime: null },
      orderBy: { acctStartTime: "desc" },
    });

    if (!activeAcct && !routerId) {
      // User tidak online di radacct dan tidak ada router spesifik
      return {
        kicked: false,
        message: `Tidak ada sesi aktif untuk ${customerUsername}.`,
      };
    }

    // 2. Cari router NAS yang sesuai
    let router = routerId
      ? await prisma.nasRouter.findUnique({ where: { id: routerId } })
      : null;

    if (!router && activeAcct?.nasIpAddress) {
      router = await prisma.nasRouter.findFirst({
        where: { ipAddress: activeAcct.nasIpAddress },
      });
    }

    if (!router) {
      router = await prisma.nasRouter.findFirst({
        where: { apiUsername: { not: null }, status: "online" },
      });
    }

    if (!router?.apiUsername) {
      return {
        kicked: false,
        message: "Router tidak memiliki kredensial API.",
      };
    }

    if (router.status === "offline") {
      return {
        kicked: false,
        message: `Router ${router.name} (${router.ipAddress}) sedang offline.`,
      };
    }

    const mikrotik = await connectRouterOS(router, 1500);
    try {
      const rows = await mikrotik.write("/ppp/active/print", [
        `?=name=${customerUsername}`,
      ]);
      let removed = 0;
      for (const r of rows) {
        const dotId = r[".id"];
        if (dotId) {
          await mikrotik.write("/ppp/active/remove", [`=.id=${dotId}`]);
          removed += 1;
        }
      }
      return {
        kicked: removed > 0,
        message:
          removed > 0
            ? `Sesi ${customerUsername} di-kick.`
            : `Tidak ada sesi aktif untuk ${customerUsername}.`,
      };
    } finally {
      mikrotik.close();
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kicked: false, message };
  }
}
