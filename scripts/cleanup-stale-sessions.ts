/**
 * Kebersihan sesi perkembangan: tutup semua sesi "live" yang basi.
 *
 * Sesi mock seed memiliki `extKey = NULL` dan tidak pernah ada di
 * `/ppp/active` router manapun — membuatnya tampak online selamanya.
 * Jalankan SEKALI setelah migrate/seed di environment development:
 *   bun -e "await import('./scripts/cleanup-stale-sessions.ts')"
 */

import { syncPortalSessionLogs } from "../src/lib/portal-logs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const now = new Date();

  // Tutup sesi live tanpa extKey (mock) — sebab aktualnya:
  // sesi tak pernah terpantau lagi oleh poller/radacct.
  const stale = await prisma.session.findMany({
    where: { stoppedAt: null, extKey: null },
    select: { id: true, startedAt: true, customerId: true },
  });

  for (const s of stale) {
    const elapsed = Math.max(
      1,
      Math.floor((now.getTime() - s.startedAt.getTime()) / 1000),
    );
    await prisma.session.update({
      where: { id: s.id },
      data: {
        stoppedAt: now,
        durationSeconds: elapsed,
        terminateCause: "Lost-Carrier",
      },
    });
    if (s.customerId) {
      await prisma.customer.updateMany({
        where: { id: s.customerId, currentSessionId: s.id },
        data: { currentSessionId: null },
      });
    }
  }

  // Rebuild log sesi portal agar tidak menampilkan sesi yang sudah ditutup
  await syncPortalSessionLogs(prisma);

  console.log(`✓ ${stale.length} sesi basi ditutup (Lost-Carrier)`);

  const remaining = await prisma.session.count({ where: { stoppedAt: null } });
  console.log(`Sesi live tersisa: ${remaining}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
