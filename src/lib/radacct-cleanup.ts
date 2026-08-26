/**
 * radacct-cleanup — Pembersihan sesi zombie / stale accounting FreeRADIUS.
 *
 * Sesi zombie terjadi jika pelanggan diskonek abnormal (mati lampu, kabel putus,
 * router reboot) sehingga FreeRADIUS tidak menerima paket Accounting-Stop.
 * Sesi ini memiliki acctStopTime = NULL tetapi acctUpdateTime tidak pernah ter-update
 * lagi (> zombieThresholdMinutes).
 *
 * Fungsi ini menutup sesi-sesi tersebut secara otomatis agar tidak memblokir
 * Simultaneous-Use atau tampil sebagai sesi aktif palsu di UI.
 */
import { prisma } from "./prisma";

export interface CleanupResult {
  closedSessionsCount: number;
  releasedPoolIpsCount: number;
}

let lastCleanupRun = 0;
const CLEANUP_THROTTLE_MS = 15_000; // Eksekusi update DB maksimal 1x per 15 detik

/**
 * Tutup seluruh sesi zombie di radacct dan lepaskan IP pool kadaluarsa.
 * @param thresholdMinutes Batas waktu tidak ada interim-update (default: 3 menit)
 * @param force Jika true, paksa eksekusi dan abaikan throttle
 */
export async function cleanupZombieSessions(
  thresholdMinutes = 3,
  force = false,
): Promise<CleanupResult> {
  const now = Date.now();
  if (!force && now - lastCleanupRun < CLEANUP_THROTTLE_MS) {
    return { closedSessionsCount: 0, releasedPoolIpsCount: 0 };
  }
  lastCleanupRun = now;

  const thresholdDate = new Date(now - thresholdMinutes * 60 * 1000);

  try {
    // 1. Update sesi zombie di radacct menjadi terminated
    const closedCount = await prisma.$executeRaw`
      UPDATE radacct
      SET 
        acctstoptime = CASE
          WHEN acctupdatetime IS NOT NULL AND acctupdatetime <= NOW() THEN acctupdatetime
          WHEN acctstarttime IS NOT NULL AND acctstarttime <= NOW() THEN acctstarttime + INTERVAL '1 minute'
          ELSE NOW()
        END,
        acctterminatecause = 'Lost-Carrier',
        acctsessiontime = GREATEST(
          COALESCE(acctsessiontime, 1),
          1,
          EXTRACT(EPOCH FROM (
            (CASE
              WHEN acctupdatetime IS NOT NULL AND acctupdatetime <= NOW() THEN acctupdatetime
              WHEN acctstarttime IS NOT NULL AND acctstarttime <= NOW() THEN acctstarttime + INTERVAL '1 minute'
              ELSE NOW()
            END) - 
            (CASE
              WHEN acctstarttime IS NOT NULL AND acctstarttime <= NOW() THEN acctstarttime
              ELSE NOW() - INTERVAL '1 minute'
            END)
          ))::bigint
        )
      WHERE acctstoptime IS NULL
        AND (
          acctupdatetime < ${thresholdDate}
          OR acctupdatetime > NOW() + INTERVAL '1 minute'
          OR (acctupdatetime IS NULL AND (acctstarttime < ${thresholdDate} OR acctstarttime > NOW() + INTERVAL '1 minute'))
        )
    `;

    // 2. Lepaskan alokasi dynamic IP pool yang kadaluarsa di radippool
    const releasedCount = await prisma.$executeRaw`
      UPDATE radippool
      SET username = '', callingstationid = '', expiry_time = NULL
      WHERE expiry_time IS NOT NULL AND expiry_time < NOW()
    `;

    if (closedCount > 0) {
      console.log(
        `[radacct-cleanup] Berhasil membersihkan ${closedCount} sesi zombie di radacct (> ${thresholdMinutes}m tanpa update / anomali jam).`,
      );
    }

    return {
      closedSessionsCount: Number(closedCount),
      releasedPoolIpsCount: Number(releasedCount),
    };
  } catch (error) {
    console.error("[radacct-cleanup] Gagal membersihkan sesi zombie:", error);
    return {
      closedSessionsCount: 0,
      releasedPoolIpsCount: 0,
    };
  }
}

/**
 * Tutup sesi zombie khusus untuk satu username pelanggan (mis. sebelum dial ulang).
 */
export async function cleanupCustomerZombieSessions(
  username: string,
  thresholdMinutes = 2,
): Promise<number> {
  if (!username) return 0;
  const thresholdDate = new Date(Date.now() - thresholdMinutes * 60 * 1000);

  try {
    const closedCount = await prisma.$executeRaw`
      UPDATE radacct
      SET 
        acctstoptime = CASE
          WHEN acctupdatetime IS NOT NULL AND acctupdatetime <= NOW() THEN acctupdatetime
          WHEN acctstarttime IS NOT NULL AND acctstarttime <= NOW() THEN acctstarttime + INTERVAL '1 minute'
          ELSE NOW()
        END,
        acctterminatecause = 'Lost-Carrier',
        acctsessiontime = GREATEST(
          COALESCE(acctsessiontime, 1),
          1,
          EXTRACT(EPOCH FROM (
            (CASE
              WHEN acctupdatetime IS NOT NULL AND acctupdatetime <= NOW() THEN acctupdatetime
              WHEN acctstarttime IS NOT NULL AND acctstarttime <= NOW() THEN acctstarttime + INTERVAL '1 minute'
              ELSE NOW()
            END) - 
            (CASE
              WHEN acctstarttime IS NOT NULL AND acctstarttime <= NOW() THEN acctstarttime
              ELSE NOW() - INTERVAL '1 minute'
            END)
          ))::bigint
        )
      WHERE username = ${username}
        AND acctstoptime IS NULL
        AND (
          acctupdatetime < ${thresholdDate}
          OR acctupdatetime > NOW() + INTERVAL '1 minute'
          OR (acctupdatetime IS NULL AND (acctstarttime < ${thresholdDate} OR acctstarttime > NOW() + INTERVAL '1 minute'))
        )
    `;
    return Number(closedCount);
  } catch (error) {
    console.error(
      `[radacct-cleanup] Gagal membersihkan sesi zombie untuk ${username}:`,
      error,
    );
    return 0;
  }
}
