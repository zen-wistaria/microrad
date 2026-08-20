/**
 * Fasilitas realtime untuk route handler:
 *  - setLiveSnapshots / buildLiveFrames dari hub global (satu proses Node)
 *  - publishMikrotikSync → BroadcastChannel (antar proses production)
 *
 * Dev: channel lokal — event langsung ke handler yang sama di proses ini.
 */
import type { LiveSnapshot } from "./hub";

type Handler = (payload: LiveSnapshot[] | null) => void;

const TOPIC = "mikrotik:sync";
const CHANNEL_NAME = "microrad-realtime";

type ChannelGlobal = typeof globalThis & {
  __microradChannel?: {
    handlers: Set<Handler>;
    bc?: BroadcastChannel;
  };
};

function channel(): NonNullable<ChannelGlobal["__microradChannel"]> {
  const g = globalThis as ChannelGlobal;
  g.__microradChannel ??= { handlers: new Set() };
  const st = g.__microradChannel as NonNullable<
    ChannelGlobal["__microradChannel"]
  >;

  if (!st.bc && typeof BroadcastChannel !== "undefined") {
    st.bc = new BroadcastChannel(CHANNEL_NAME);
    st.bc.onmessage = (ev: MessageEvent) => {
      const data = ev.data as {
        topic?: string;
        payload?: LiveSnapshot[] | null;
      };
      if (data?.topic === TOPIC) {
        for (const h of st.handlers) h(data.payload ?? null);
      }
    };
  }
  return st;
}

export function publishMikrotikSync(
  snapshots: LiveSnapshot[] | null = null,
): void {
  const st = channel();
  st.bc?.postMessage({ topic: TOPIC, payload: snapshots });
  // handler lokal tetap dipanggil langsung (dev, tanpa BroadcastChannel)
  for (const h of st.handlers) h(snapshots ?? null);
}

export function subscribeMikrotikSync(
  handler: (payload: LiveSnapshot[] | null) => void,
): () => void {
  const st = channel();
  st.handlers.add(handler);
  return () => {
    st.handlers.delete(handler);
  };
}
