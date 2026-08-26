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
 * Format nilai Mikrotik-Rate-Limit RouterOS (6 Posisi Posisional Baku):
 *   1. rx-rate/tx-rate (Rate normal / max-limit)
 *   2. rx-burst-rate/tx-burst-rate (Burst limit) -> 0/0 jika tidak diisi
 *   3. rx-burst-threshold/tx-burst-threshold (Burst threshold) -> 0/0 jika tidak diisi
 *   4. rx-burst-time/tx-burst-time (Burst time) -> 0/0 jika tidak diisi
 *   5. priority (Prioritas queue 1..8) -> default 8
 *   6. rx-rate-min/tx-rate-min (Limit-at / Guaranteed rate) -> 0/0 jika tidak diisi
 *
 * Contoh lengkap: "1m/1m 1100k/1100k 512k/512k 10/10 8 1m/1m"
 * Contoh max + CIR: "1m/1m 0/0 0/0 0/0 8 500k/500k"
 * Contoh hanya max: "1m/1m 0/0 0/0 0/0 8 0/0"
 */
export function rateLimitValue(cfg: RateLimitConfig): string {
  // Catatan arah: di RouterOS rx = client DOWNLOAD, tx = client UPLOAD.
  // Field "Download" aplikasi = rx (position 1), "Upload" = tx (position 2).

  // 1) rx-rate/tx-rate (Wajib)
  const rx = normKbps(cfg.maxDownload);
  const tx = normKbps(cfg.maxUpload) ?? rx;
  if (!rx) throw new Error("Download rate wajib diisi.");
  const pos1 = `${rx}/${tx}`;

  // Cek apakah seluruh field burst terisi lengkap
  const hasBurst = Boolean(
    cfg.burstDownload &&
      cfg.burstUpload &&
      cfg.burstThresholdDownload &&
      cfg.burstThresholdUp &&
      cfg.burstTimeSeconds &&
      cfg.burstTimeSeconds > 0,
  );

  let pos2 = "0/0";
  let pos3 = "0/0";
  let pos4 = "0/0";

  if (hasBurst) {
    const brx = clampAtLeast(normKbps(cfg.burstDownload), rx) ?? rx;
    const btx = clampAtLeast(normKbps(cfg.burstUpload), tx) ?? tx;
    const trx = capAtMost(normKbps(cfg.burstThresholdDownload), rx) ?? rx;
    const ttx = capAtMost(normKbps(cfg.burstThresholdUp), tx) ?? tx;
    const bt = cfg.burstTimeSeconds;

    pos2 = `${brx}/${btx}`;
    pos3 = `${trx}/${ttx}`;
    pos4 = `${bt}/${bt}`;
  }

  // 5) priority (1..8, default 8)
  const prio = cfg.priority ? Math.min(Math.max(cfg.priority, 1), 8) : 8;
  const pos5 = String(prio);

  // 6) rx-rate-min/tx-rate-min = limit-at (CIR)
  let pos6 = "0/0";
  if (cfg.limitAtDownload || cfg.limitAtUp) {
    const lrx = capAtMost(normKbps(cfg.limitAtDownload), rx);
    const ltx = capAtMost(normKbps(cfg.limitAtUp), tx);
    if (lrx || ltx) {
      pos6 = `${lrx ?? ltx}/${ltx ?? lrx}`;
    }
  }

  return `${pos1} ${pos2} ${pos3} ${pos4} ${pos5} ${pos6}`;
}

export interface BandwidthRateInput {
  minUpload?: number | null;
  minUploadUnit?: string | null;
  minDownload?: number | null;
  minDownloadUnit?: string | null;
  maxUpload: number;
  maxUploadUnit?: string | null;
  maxDownload: number;
  maxDownloadUnit?: string | null;
  burstLimitUpload?: number | null;
  burstLimitUploadUnit?: string | null;
  burstLimitDownload?: number | null;
  burstLimitDownloadUnit?: string | null;
  burstThresholdUpload?: number | null;
  burstThresholdUploadUnit?: string | null;
  burstThresholdDownload?: number | null;
  burstThresholdDownloadUnit?: string | null;
  burstTime?: number | null;
}

function unitVal(
  val?: number | null,
  unit?: string | null,
): string | undefined {
  if (val === undefined || val === null || val <= 0) return undefined;
  const u = (unit ?? "Mbps").toLowerCase().startsWith("k") ? "k" : "m";
  return `${val}${u}`;
}

export function formatBandwidthRateLimit(
  bw: BandwidthRateInput,
  priority = 8,
): string {
  const maxDown = unitVal(bw.maxDownload, bw.maxDownloadUnit) || "1m";
  const maxUp = unitVal(bw.maxUpload, bw.maxUploadUnit) || maxDown;

  const hasBurst = Boolean(
    bw.burstLimitDownload &&
      bw.burstLimitUpload &&
      bw.burstThresholdDownload &&
      bw.burstThresholdUpload &&
      bw.burstTime,
  );

  return rateLimitValue({
    maxDownload: maxDown,
    maxUpload: maxUp,
    burstDownload: hasBurst
      ? unitVal(bw.burstLimitDownload, bw.burstLimitDownloadUnit)
      : undefined,
    burstUpload: hasBurst
      ? unitVal(bw.burstLimitUpload, bw.burstLimitUploadUnit)
      : undefined,
    burstThresholdDownload: hasBurst
      ? unitVal(bw.burstThresholdDownload, bw.burstThresholdDownloadUnit)
      : undefined,
    burstThresholdUp: hasBurst
      ? unitVal(bw.burstThresholdUpload, bw.burstThresholdUploadUnit)
      : undefined,
    burstTimeSeconds: hasBurst ? (bw.burstTime ?? undefined) : undefined,
    priority: priority || 8,
    limitAtDownload: unitVal(bw.minDownload, bw.minDownloadUnit),
    limitAtUp: unitVal(bw.minUpload, bw.minUploadUnit),
  });
}

// Keep backward-compat callers (radsync) working
export function rateLimitValueOld(downMbps: number, upMbps: number): string {
  return rateLimitValue({
    maxDownload: `${downMbps}m`,
    maxUpload: `${upMbps}m`,
  });
}
export { rateLimitValue as rateLimitValueNew };

/** IP adalah IP privat/loopback? (helper kebijakan sekuriti opsional) */
export function isPrivateIp(ip: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}
