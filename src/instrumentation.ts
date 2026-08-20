/**
 * Next.js instrumentation — dijalankan sekali saat server Node start.
 * Menyalakan poller sinkronisasi sesi PPPoE MikroTik (MIKROTIK_SYNC_ENABLED).
 *
 * HMR dev: modul diimport ulang oleh Turbopack → interval lama bisa mati
 * tanpa `unref`. Kami pakai interval ber-"restart guard" di dalam
 * startMikrotikSync (cek timestamp terakhir) + log di sini untuk diagnosa.
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
