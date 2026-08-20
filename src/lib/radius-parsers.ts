/**
 * Parser nilai yang dikembalikan RouterOS API (node-routeros).
 * RouterOS mengembalikan semuanya sebagai string — byte bisa bersuffix
 * ("12345678" / "1,234.5 KiB" / "10.0 GiB"), uptime berformat human
 * ("1d2h3m4s" / "2h3m4s" / "30m" / "1w2d..."). Robust terhadap varian
 * locale/BIOS.
 */

export interface ActivePppRow {
  dotId: string;
  name: string;
  callerId?: string;
  address?: string;
  service: string;
  sessionId: string;
  uptimeSec: number;
  bytesIn: bigint;
  bytesOut: bigint;
  radius: boolean;
}

/** "1w2d3h4m5s" | "1d2h3m4s" | "2h3m4s" | "30m" -> detik */
export function parseUptime(uptime: string | undefined): number {
  if (!uptime) return 0;
  const m = uptime.match(
    /(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/,
  );
  if (!m) return 0;
  const [, w, d, h, mi, s] = m;
  return (
    (Number(w) || 0) * 7 * 86400 +
    (Number(d) || 0) * 86400 +
    (Number(h) || 0) * 3600 +
    (Number(mi) || 0) * 60 +
    (Number(s) || 0)
  );
}

const BYTE_MULT: Record<string, bigint> = {
  B: BigInt(1),
  K: BigInt(1024),
  M: BigInt(1048576),
  G: BigInt(1073741824),
  T: BigInt(1099511627776),
};

/** "12345678" | "1,234.5 KiB" | "10.0 GiB" | "1.2MiB" -> byte (bigint) */
export function parseRouterBytes(value: string | number | undefined): bigint {
  if (value === undefined || value === null) return 0n;
  if (typeof value === "number") {
    return BigInt(Math.max(0, Math.floor(value)));
  }
  const s = String(value).replace(/,/g, "").trim();
  const m = s.match(/^([\d.]+)\s*(B|K|M|G|T)?i?B?$/i);
  if (!m) return BigInt(Number(s) || 0);
  const num = parseFloat(m[1]);
  const mult = (BYTE_MULT[m[2]?.toUpperCase() ?? "B"] ?? 1n) as bigint;
  return BigInt(Math.round(num)) * mult;
}

/** Baris "/ppp/active/print" -> ActivePppRow (null bila tanpa name) */
export function parseActiveRow(
  row: Record<string, string>,
): ActivePppRow | null {
  const name = row.name;
  if (!name) return null;
  return {
    dotId: row[".id"] ?? "",
    name,
    callerId: row["caller-id"] ?? undefined,
    address: row.address ?? undefined,
    service: row.service ?? "pppoe",
    sessionId: row["session-id"] ?? "",
    uptimeSec: parseUptime(row.uptime),
    bytesIn: parseRouterBytes(row["bytes-in"]),
    bytesOut: parseRouterBytes(row["bytes-out"]),
    radius: row.radius === "yes" || row.radius === "true",
  };
}
