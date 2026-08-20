/**
 * Konversi bentuk RADIUS / RouterOS — dipakai radsync, poller MikroTik,
 * dan preview UI.
 */

export interface RateLimitConfig {
  /** Max limit — kecepatan puncak (tx/rx), mis. "1M" */
  maxDownload: string;
  maxUpload: string;
  /** Burst limit — batas saat burst aktif, mis. "1500k" */
  burstDownload?: string;
  burstUpload?: string;
  /** Burst threshold — ambang sebelum burst aktif, mis. "512k" */
  burstThresholdDownload?: string;
  burstThresholdUp?: string;
  /** Burst time — durasi (detik), mis. 12 */
  burstTimeSeconds?: number;
  /** Priority — 1..8 (1 tertinggi), default 8 */
  priority?: number;
  /** Limit-at — kecepatan minimum terjamin (CIR), mis. "64k" */
  limitAtDownload?: string;
  limitAtUp?: string;
}

function normKbps(v: string | undefined): string | undefined {
  if (v === undefined || v === "") return undefined;
  const s = v.trim().toLowerCase();
  // Terima angka polos (dianggap kbps) atau format k/m
  if (/^\d+(\.\d+)?$/.test(s)) return `${s}k`;
  return s;
}

/** Konversi nilai kecepatan ("1500k", "2m", "1M/...") ke angka kbps (untuk perbandingan). */
function toKbpsNum(v: string | undefined): number | undefined {
  const s = normKbps(v);
  if (!s) return undefined;
  const m = s.match(/^([\d.]+)\s*([kmg])?$/);
  if (!m) return undefined;
  const n = Number(m[1]);
  const mult = m[2] === "m" ? 1000 : m[2] === "g" ? 1_000_000 : 1;
  return n * mult;
}

/** Clamp satu nilai ke minimum (dalam kbps) bila lebih kecil. */
function clampAtLeast(
  v: string | undefined,
  min: string | undefined,
): string | undefined {
  const num = toKbpsNum(v);
  const minNum = toKbpsNum(min);
  if (
    v !== undefined &&
    num !== undefined &&
    minNum !== undefined &&
    num < minNum
  ) {
    return min;
  }
  return v;
}

/** Batasi nilai maksimum (cap) bila lebih besar — untuk threshold & limit-at. */
function capAtMost(
  v: string | undefined,
  max: string | undefined,
): string | undefined {
  const num = toKbpsNum(v);
  const maxNum = toKbpsNum(max);
  if (
    v !== undefined &&
    num !== undefined &&
    maxNum !== undefined &&
    num > maxNum
  ) {
    return max;
  }
  return v;
}

/**
 * Format nilai Mikrotik-Rate-Limit RouterOS:
 *   rx-rate[/tx-rate] [rx-burst-rate[/tx-burst-rate]
 *   [rx-burst-threshold[/tx-burst-threshold] [rx-burst-time[/tx-burst-time]
 *   [priority] [rx-rate-min[/tx-rate-min]]]]
 * (RouterOS menerima bentuk parsial; nilai kosong membiarkan default.)
 *
 * Contoh lengkap: "1M/1M  1500k/1500k  512k/512k  12/12  8  64k/64k"
 */
export function rateLimitValue(cfg: RateLimitConfig): string {
  // Catatan arah: di RouterOS rx = client DOWNLOAD, tx = client UPLOAD.
  // Field "Download" aplikasi = rx (position 1), "Upload" = tx (position 2).
  //
  // Aturan RouterOS (ketat):
  //  - rx-rate wajib; tx default = rx.
  //  - burst-rate BUKAN boleh lebih kecil dari max-limit (error
  //    "could not add queue: download-burst-limit less than ..."). Karena
  //    itu bila burst < max, kita CLAMP ke max (tidak drop).
  //  - burst-threshold default = max-rate bila diomis.
  //  - burst-time default 1s. Priority hanya sah bila burst-time hadir
  //    (parse posisional).
  //  - limit-at (rate-min) default = max-rate; tidak boleh > max-rate.
  const parts: string[] = [];

  // 1) rx-rate/tx-rate Wajib
  const rx = normKbps(cfg.maxDownload);
  const tx = normKbps(cfg.maxUpload);
  if (!rx) throw new Error("Download rate wajib diisi.");
  parts.push(`${rx}/${tx ?? rx}`);

  // 2) rx-burst-rate/tx-burst-rate (opsional; harus >= max)
  const brx = clampAtLeast(normKbps(cfg.burstDownload), rx);
  const btx = clampAtLeast(normKbps(cfg.burstUpload), tx ?? rx);
  if (brx || btx) parts.push(`${brx ?? rx}/${btx ?? rx}`);

  // 3) rx-burst-threshold/tx-burst-threshold (opsional; default = max).
  //    Threshold TIDAK boleh > max-rate (dibatasi atas), tapi BOLEH lebih
  //    kecil dari burst-rate (memang itu gunanya: burst mati setelah
  //    melewati threshold).
  const trx = capAtMost(normKbps(cfg.burstThresholdDownload), rx);
  const ttx = capAtMost(normKbps(cfg.burstThresholdUp), tx ?? rx);
  if (trx || ttx) parts.push(`${trx ?? rx}/${ttx ?? rx}`);

  // 4) rx-burst-time/tx-burst-time (opsional; pasangan)
  const bt = cfg.burstTimeSeconds;
  if (bt) parts.push(`${bt}/${bt}`);

  // 5) priority (opsional; parse posisional — hanya bila burst-time hadir)
  const prio = cfg.priority;
  if (prio) parts.push(String(prio));

  // 6) rx-rate-min/tx-rate-min = limit-at (opsional; default = max; tidak
  //    boleh > max-rate). Hanya ditulis bila salah satu sisi diisi.
  const lrx = capAtMost(normKbps(cfg.limitAtDownload), rx);
  const ltx = capAtMost(normKbps(cfg.limitAtUp), tx ?? rx);
  if (lrx || ltx) {
    parts.push(`${lrx ?? rx}/${ltx ?? tx ?? rx}`);
  }

  return parts.join(" ");
}

// Keep backward-compat callers (radsync) working
export function rateLimitValueOld(downMbps: number, upMbps: number): string {
  return rateLimitValue({
    maxDownload: `${downMbps}M`,
    maxUpload: `${upMbps}M`,
  });
}
export { rateLimitValue as rateLimitValueNew };

/** IP adalah IP privat/loopback? (helper kebijakan sekuriti opsional) */
export function isPrivateIp(ip: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}
