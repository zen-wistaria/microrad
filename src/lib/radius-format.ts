/**
 * Konversi bentuk RADIUS / RouterOS — dipakai radsync, poller MikroTik,
 * dan preview UI.
 */

/** Format nilai Mikrotik-Rate-Limit: "50M/25M" */
export function rateLimitValue(downMbps: number, upMbps: number): string {
  return `${Math.round(downMbps)}M/${Math.round(upMbps)}M`;
}

/** IP adalah IP privat/loopback? (helper kebijakan sekuriti opsional) */
export function isPrivateIp(ip: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}
