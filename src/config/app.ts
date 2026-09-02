/**
 * Konfigurasi metadata aplikasi (Server-Side Runtime).
 *
 * Data dibaca langsung dari environment variables (.env) di runtime server
 * menggunakan getter agar nilainya selalu dinamis (tidak di-bake / di-inline saat build).
 */

export function getAppConfig() {
  const name =
    process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || "MicroRAD";

  const year =
    process.env.APP_YEAR ||
    process.env.APP_CREATED_YEAR ||
    process.env.NEXT_PUBLIC_APP_YEAR ||
    "2025";

  const version =
    process.env.APP_VERSION || process.env.NEXT_PUBLIC_APP_VERSION || "v0.2.0";

  return {
    name,
    year,
    createdYear: year,
    version,
    footerText: `${name} @ ${year} | ${version}`,
  } as const;
}

export const appConfig = {
  get name(): string {
    return (
      process.env.APP_NAME || process.env.NEXT_PUBLIC_APP_NAME || "MicroRAD"
    );
  },
  get year(): string {
    return (
      process.env.APP_YEAR ||
      process.env.APP_CREATED_YEAR ||
      process.env.NEXT_PUBLIC_APP_YEAR ||
      "2025"
    );
  },
  get createdYear(): string {
    return this.year;
  },
  get version(): string {
    return (
      process.env.APP_VERSION || process.env.NEXT_PUBLIC_APP_VERSION || "v0.2.0"
    );
  },
  /**
   * Format standar footer:
   * "nama aplikasi @ tahun dibuat | versi aplikasi"
   */
  get footerText(): string {
    return `${this.name} @ ${this.year} | ${this.version}`;
  },
};

export const APP_CONFIG = appConfig;

/**
 * Helper untuk memformat teks footer secara konsisten.
 */
export function formatAppFooter(customYear?: string): string {
  return `${appConfig.name} @ ${customYear || appConfig.year} | ${appConfig.version}`;
}

export type AppConfig = ReturnType<typeof getAppConfig>;
export default appConfig;
