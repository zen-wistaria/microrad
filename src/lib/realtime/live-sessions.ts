/**
 * Sumber kebenaran sesi live — dipakai route sessions GET, dashboard,
 * dan customer detail. Prioritas: (1) snapshot hub realtime (poller
 * MikroTik bila aktif), (2) tabel Session yang masih live.
 */
import type { Session } from "@/lib/types";
import { publishMikrotikSync, subscribeMikrotikSync } from "./channel";
import {
  buildLiveFrames,
  buildLiveFromDb,
  type LiveSnapshot,
  mergeLive,
  setLiveSnapshots,
  sortLiveByStartedAt,
} from "./hub";

export type LiveSessionsResult = {
  snapshots: LiveSnapshot[];
  source: "hub" | "db" | "empty";
  at: Date;
};

/** Instal listener permanen (sekali per proses Node). */
export function installRealtimeListener(): void {
  const g = globalThis as typeof globalThis & {
    __microradLiveInstalled?: boolean;
  };
  if (g.__microradLiveInstalled) return;
  g.__microradLiveInstalled = true;
  subscribeMikrotikSync(async (snapshots) => {
    if (snapshots) {
      setLiveSnapshots(snapshots);
      return;
    }
    try {
      const db = await buildLiveFromDb();
      setLiveSnapshots(db);
    } catch {
      // DB belum siap — snapshot tetap dipakai nanti
    }
  });
}

/**
 * Dapatkan sesi live terkini. Memuat dari hub bila snapshot masih segar,
 * fallback ke DB (dan memperbarui hub). Polling klien hanya memanggil ini.
 */
export async function getLiveSessions(): Promise<LiveSessionsResult> {
  installRealtimeListener();
  const now = new Date();
  const hubFrames = buildLiveFrames(now);

  if (hubFrames.length > 0) {
    return { snapshots: hubFrames, source: "hub", at: now };
  }

  try {
    const dbFrames = await buildLiveFromDb(now);
    if (dbFrames.length > 0) {
      setLiveSnapshots(dbFrames, now);
      return { snapshots: dbFrames, source: "db", at: now };
    }
  } catch {
    // DB error — jangan crash API
  }
  return { snapshots: [], source: "empty", at: now };
}

/** Setelah mutasi sesi (create/close), perbarui hub + broadcast. */
export async function refreshLiveAfterMutation(): Promise<void> {
  const now = new Date();
  const frames = await buildLiveFromDb(now);
  setLiveSnapshots(frames, now);
  publishMikrotikSync(frames);
}

/** Sesi ke tipe Session, urut per mulai. */
export function snapshotsToSessions(snapshots: LiveSnapshot[]): Session[] {
  return sortLiveByStartedAt(snapshots).map((s) => s.session);
}

export function mergeWithDb(
  hubFrames: LiveSnapshot[],
  dbFrames: LiveSnapshot[],
): LiveSnapshot[] {
  return sortLiveByStartedAt(mergeLive(hubFrames, dbFrames));
}
