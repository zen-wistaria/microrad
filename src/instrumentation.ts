/**
 * Next.js instrumentation — dijalankan sekali saat server Node start.
 * Menyalakan poller sinkronisasi sesi PPPoE MikroTik (MIKROTIK_SYNC_ENABLED).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { startMikrotikSync } = await import("./lib/mikrotik-sync");
    startMikrotikSync();
    console.log("[mikrotik-sync] poller diaktifkan");
  } catch (e) {
    console.error("[mikrotik-sync] gagal memulai:", e);
  }
}
