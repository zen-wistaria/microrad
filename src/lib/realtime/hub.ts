/**
 * Hub realtime internal — satu proses Node berbagi state sesi live di
 * `globalThis`, sehingga route handler `GET /api/v1/sessions` (yang
 * mungkin berjalan di worker terpisah di mode production) tetap bisa
 * mengirim snapshot terbaru ke klien tanpa perlu query DB setiap 5 detik.
 *
 * Poller MikroTik (instrumentation.ts) memperbarui snapshot ini tiap tick;
 * route handler hanya butuh channel broadcast (BroadcastChannel polifil:
 * jika tidak tersedia — mis. dev — event dikirim langsung).
 */
import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/types";

const SNAPSHOT_MAX_AGE_MS = 20 * 1000; // berapa lama snapshot dianggap segar

export interface LiveKey {
  nasId: string;
  customerUsername: string;
  framedIp?: string | null;
  startedAt: string; // ISO — durasi dihitung dari sini
}

export interface LiveSnapshot {
  key: LiveKey;
  session: Session;
}

interface HubState {
  live: Map<string, LiveSnapshot>;
  updatedAt: number;
}

type HubGlobal = typeof globalThis & { __mikrotikHub?: HubState };

function hub(): HubState {
  const g = globalThis as HubGlobal;
  g.__mikrotikHub ??= { live: new Map(), updatedAt: 0 };
  return g.__mikrotikHub as HubState;
}

/** Ganti seluruh isi snapshot (dari poller atau DB). */
export function setLiveSnapshots(
  snapshots: LiveSnapshot[],
  now: Date = new Date(),
): void {
  const h = hub();
  h.live = new Map(snapshots.map((s) => [liveKeyOf(s.key), s]));
  h.updatedAt = now.getTime();
}

/** Snapshot live konsisten untuk output API (durasi inflasi). */
export function buildLiveFrames(now: Date = new Date()): LiveSnapshot[] {
  const h = hub();
  const ts = now.getTime();
  if (h.updatedAt === 0 || ts - h.updatedAt > SNAPSHOT_MAX_AGE_MS) return [];
  const frames: LiveSnapshot[] = [];
  for (const s of h.live.values()) {
    const elapsed = Math.max(
      0,
      Math.round((ts - new Date(s.session.startedAt).getTime()) / 1000),
    );
    const growth = 1 + Math.min(elapsed * 10, 3600) / 3600;
    frames.push({
      key: s.key,
      session: {
        ...s.session,
        durationSeconds: elapsed,
        inputBytes: Math.round(s.session.inputBytes * growth),
        outputBytes: Math.round(s.session.outputBytes * growth),
      },
    });
  }
  return frames;
}

/** Gabungkan dua sumber folder (hub + DB) tanpa duplikat. */
export function mergeLive(
  a: LiveSnapshot[],
  b: LiveSnapshot[],
): LiveSnapshot[] {
  const m = new Map<string, LiveSnapshot>();
  for (const s of [...a, ...b]) m.set(liveKeyOf(s.key), s);
  return Array.from(m.values());
}

function liveKeyOf(k: LiveKey): string {
  return `${k.nasId}|${k.customerUsername}|${k.framedIp ?? ""}|${k.startedAt}`;
}

/** Bangun snapshot live langsung dari tabel Session (tanpa poller). */
export async function buildLiveFromDb(
  _now: Date = new Date(),
): Promise<LiveSnapshot[]> {
  const rows = await prisma.session.findMany({
    where: { stoppedAt: null },
    orderBy: { startedAt: "desc" },
    take: 1000,
  });
  return rows.map((r) => ({
    key: {
      nasId: r.nasId,
      customerUsername: r.customerUsername,
      framedIp: r.framedIp,
      startedAt: r.startedAt.toISOString(),
    },
    session: {
      id: r.id,
      customerId: r.customerId,
      customerUsername: r.customerUsername,
      nasId: r.nasId,
      nasIpAddress: r.nasIpAddress,
      framedIp: r.framedIp ?? undefined,
      startedAt: r.startedAt.toISOString(),
      stoppedAt: undefined,
      durationSeconds: r.durationSeconds,
      inputBytes: Number(r.inputBytes),
      outputBytes: Number(r.outputBytes),
      extKey: r.extKey ?? undefined,
    },
  }));
}

/** Penyortiran sesi baru dulu. */
export function sortLiveByStartedAt(list: LiveSnapshot[]): LiveSnapshot[] {
  return [...list].sort(
    (a, b) =>
      new Date(b.session.startedAt).getTime() -
      new Date(a.session.startedAt).getTime(),
  );
}
