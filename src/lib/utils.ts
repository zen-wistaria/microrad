import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format bytes to human readable string (e.g. 1.25 GB, 840 MB)
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 B";
  if (!bytes || Number.isNaN(bytes)) return "0 B";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const clampedIndex = Math.min(i, sizes.length - 1);

  return `${parseFloat((bytes / k ** clampedIndex).toFixed(dm))} ${sizes[clampedIndex]}`;
}

/**
 * Format seconds into HH:MM:SS or human readable "2h 15m"
 */
export function formatDuration(
  seconds: number,
  format: "short" | "human" = "human",
): string {
  if (!seconds || seconds <= 0) return "0m";

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (format === "short") {
    const pad = (n: number) => n.toString().padStart(2, "0");
    if (hrs > 0) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  const parts = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
  if (hrs === 0 && mins < 5) parts.push(`${secs}s`);

  return parts.join(" ") || "0m";
}

/**
 * Format date string to localized readable format
 */
export function formatDate(dateString?: string | null): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Format relative time (e.g. "5 menit lalu", "2 jam lalu")
 */
export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return "Belum pernah";
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "-";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "Baru saja";
    if (diffMin < 60) return `${diffMin} menit yang lalu`;
    if (diffHour < 24) return `${diffHour} jam yang lalu`;
    if (diffDay < 30) return `${diffDay} hari yang lalu`;
    return formatDate(dateString);
  } catch {
    return dateString;
  }
}

/**
 * Format bandwidth rate (e.g. 10 Mbps)
 */
export function formatRate(mbps: number): string {
  if (!mbps && mbps !== 0) return "0 Mbps";
  return `${mbps} Mbps`;
}

/**
 * Format number to Indonesian Rupiah currency string (e.g. Rp 165.000)
 */
export function formatRupiah(amount?: number | null): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return "Rp 0";
  }
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Helper to simulate network latency
 */
export const delay = (ms = 150) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Convert number to Indonesian words (Terbilang)
 */
export function terbilangRupiah(num: number): string {
  if (!num || num === 0) return "Nol Rupiah";
  const satuan = [
    "",
    "Satu",
    "Dua",
    "Tiga",
    "Empat",
    "Lima",
    "Enam",
    "Tujuh",
    "Delapan",
    "Sembilan",
    "Sepuluh",
    "Sebelas",
  ];

  function convert(n: number): string {
    if (n < 12) return satuan[n];
    if (n < 20) return `${convert(n - 10)} Belas`;
    if (n < 100)
      return `${convert(Math.floor(n / 10))} Puluh ${convert(n % 10)}`.trim();
    if (n < 200) return `Seratus ${convert(n - 100)}`.trim();
    if (n < 1000)
      return `${convert(Math.floor(n / 100))} Ratus ${convert(n % 100)}`.trim();
    if (n < 2000) return `Seribu ${convert(n - 1000)}`.trim();
    if (n < 1000000)
      return `${convert(Math.floor(n / 1000))} Ribu ${convert(n % 1000)}`.trim();
    if (n < 1000000000)
      return `${convert(Math.floor(n / 1000000))} Juta ${convert(n % 1000000)}`.trim();
    if (n < 1000000000000)
      return `${convert(Math.floor(n / 1000000000))} Miliar ${convert(n % 1000000000)}`.trim();
    return `${convert(Math.floor(n / 1000000000000))} Triliun ${convert(n % 1000000000000)}`.trim();
  }

  const result = convert(Math.abs(Math.floor(num)));
  return `${result.replace(/\s+/g, " ")} Rupiah`;
}
