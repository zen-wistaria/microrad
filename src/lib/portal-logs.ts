/**
 * Sinkronisasi log sesi portal (portal_session_log) dari tabel Session.
 *
 * Tabel Session mencatat sesi PPPoE (live dari poller MikroTik + radacct).
 * Saat poller menjalankan sync (tiap tick), tabel portal_session_log
 * diperbarui agar Log Sesi di Portal Pelanggan berisi riwayat nyata
 * (bukan synthetic).
 *
 * Strategi: hapus semua baris portal_session_log lalu isi ulang dari
 * session yang memiliki customerId terisi. Idempotent — aman dipanggil
 * berulang kali.
 */
import type { Prisma } from "@/generated/prisma";

export async function syncPortalSessionLogs(
  db: Prisma.TransactionClient | typeof import("@/lib/prisma")["prisma"],
) {
  const sessions = await db.session.findMany({
    where: { customerId: { not: null } },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      customerId: true,
      customerUsername: true,
      nasIpAddress: true,
      framedIp: true,
      startedAt: true,
      stoppedAt: true,
      durationSeconds: true,
      inputBytes: true,
      outputBytes: true,
      terminateCause: true,
    },
    take: 500,
  });

  // Hapus isi lama agar sinkron (tabel log milik portal — aman di-rebuild)
  await db.portalSessionLog.deleteMany({});

  if (sessions.length === 0) return;

  await db.portalSessionLog.createMany({
    data: sessions.map((s) => ({
      id: `plog-sess-${s.id}`,
      customerId: s.customerId!,
      customerUsername: s.customerUsername,
      nasIpAddress: s.nasIpAddress,
      framedIp: s.framedIp ?? undefined,
      startedAt: s.startedAt,
      stoppedAt: s.stoppedAt ?? undefined,
      durationSeconds: s.durationSeconds,
      inputBytes: s.inputBytes,
      outputBytes: s.outputBytes,
      terminateCause: s.terminateCause ?? undefined,
    })),
  });
}
