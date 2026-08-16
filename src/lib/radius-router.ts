/**
 * Helper bersama route radius & router: reload FreeRADIUS (SIGHUP) via
 * docker exec, dan konfigurasi RADIUS di MikroTik via API.
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { MikrotikConn } from "./mikrotik-client";

const execAsync = promisify(exec);

export const FREERADIUS_IP = () => process.env.FREERADIUS_IP ?? "172.30.0.3";

/** SIGHUP ke FreeRADIUS agar read_clients=yes membaca ulang tabel nas. */
export async function triggerRadiusReload(): Promise<boolean> {
  try {
    const { stdout, stderr } = await execAsync(
      "docker exec microrad-freeradius kill -HUP 1",
      { timeout: 10_000 },
    );
    console.log("[radius-reload] HUP terkirim:", stdout.trim(), stderr.trim());
    return true;
  } catch (e) {
    console.warn("[radius-reload] gagal (lanjut tanpa reload):", e);
    return false;
  }
}

/**
 * Konfigurasi RADIUS client di MikroTik: hapus entri lama utk IP FreeRADIUS,
 * tambah baru, aktifkan use-radius+accounting. Idempotent.
 */
export async function configureRadiusOnRouter(
  mikrotik: MikrotikConn,
  radiusSecret: string,
): Promise<{ added: number; removed: number }> {
  const radiusIp = FREERADIUS_IP();
  // Hapus entri radius lama utk FreeRADIUS (idempotent)
  const existing = await mikrotik.write("/radius/print", [
    `?address=${radiusIp}`,
  ]);
  for (const e of existing) {
    const dotId = e["=.id"];
    if (dotId) {
      await mikrotik.write("/radius/remove", [`=.id=${dotId}`]);
    }
  }
  // Tambah entri baru
  await mikrotik.write("/radius/add", [
    "=service=ppp",
    `=address=${radiusIp}`,
    `=secret=${radiusSecret}`,
  ]);
  // Aktifkan RADIUS untuk PPP (accounting + interim)
  await mikrotik.write("/ppp/aaa/set", [
    "=use-radius=yes",
    "=accounting=yes",
    "=interim-update=1m",
  ]);
  return { added: 1, removed: existing.length };
}

/** Hapus semua entri RADIUS utk FreeRADIUS + matikan use-radius. */
export async function removeRadiusFromRouter(
  mikrotik: MikrotikConn,
): Promise<number> {
  const radiusIp = FREERADIUS_IP();
  const existing = await mikrotik.write("/radius/print", [
    `?address=${radiusIp}`,
  ]);
  for (const e of existing) {
    const dotId = e["=.id"];
    if (dotId) {
      await mikrotik.write("/radius/remove", [`=.id=${dotId}`]);
    }
  }
  await mikrotik.write("/ppp/aaa/set", ["=use-radius=no", "=accounting=no"]);
  return existing.length;
}
