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
