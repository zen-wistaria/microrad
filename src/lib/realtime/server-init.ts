/**
 * Inisialisasi realtime di proses server (custom server / production).
 * - installRealtimeListener: memuat snapshot live awal dari DB.
 * - serveRealtimeStart: mulai broadcast snapshot awal (jika ada).
 */

import { publishMikrotikSync, subscribeMikrotikSync } from "./channel";
import { buildLiveFromDb, setLiveSnapshots } from "./hub";
import { installRealtimeListener } from "./live-sessions";
import { pushRealtime } from "./ws-server";

export { installRealtimeListener };

export async function serveRealtimeStart(): Promise<void> {
  installRealtimeListener();
  try {
    const frames = await buildLiveFromDb(new Date());
    setLiveSnapshots(frames, new Date());
    publishMikrotikSync(frames);
  } catch {
    // DB belum siap — poller/route akan memperbarui nanti
  }
  // Hubungkan event broadcast ke WebSocket (production: push langsung)
  subscribeMikrotikSync((snapshots) => {
    if (snapshots) pushRealtime(snapshots);
  });

  // Refresh berkala bila tidak ada poller aktif
  const timer = setInterval(async () => {
    try {
      const frames = await buildLiveFromDb(new Date());
      setLiveSnapshots(frames, new Date());
      publishMikrotikSync(frames);
    } catch {
      // abaikan — coba lagi interval berikutnya
    }
  }, 15_000);
  (timer as NodeJS.Timeout & { unref?: () => void }).unref?.();
}
