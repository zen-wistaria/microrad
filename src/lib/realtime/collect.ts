/**
 * Kolektor live snapshot untuk REST route — satu helper yang dipakai
 * sessions GET, dashboard GET, dan customer detail. Menghindari query
 * berulang di tiap request dengan mengambil dari hub realtime bila segar.
 * (Saat ini: ambil langsung dari DB yang selalu mutakhir.)
 */

import type { LiveSnapshot } from "./hub";
import { buildLiveFromDb } from "./hub";

export interface LiveCollectResult {
  snapshots: LiveSnapshot[];
  source: "hub" | "db" | "empty";
}

/**
 * Ambil folder live untuk satu / semua NAS.
 * @param nasId bila diisi, hanya folder NAS yang dikembalikan.
 */
export async function collectLiveSnapshots(
  nasId?: string,
  now: Date = new Date(),
): Promise<LiveCollectResult> {
  try {
    const dbFrames = await buildLiveFromDb(now);
    const filtered = nasId
      ? dbFrames.filter((f) => f.key.nasId === nasId)
      : dbFrames;
    return {
      snapshots: filtered,
      source: filtered.length > 0 ? "db" : "empty",
    };
  } catch {
    return { snapshots: [], source: "empty" };
  }
}
