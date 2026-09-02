import type React from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Footer } from "@/components/layout/footer";
import { appConfig } from "@/config/app";

/**
 * Server Component Layout untuk Dashboard.
 *
 * Mengambil metadata aplikasi (APP_NAME, APP_VERSION) secara dinamis di server
 * dan menyisipkan Server Component Footer.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell
      appName={appConfig.name}
      appVersion={appConfig.version}
      footer={<Footer />}
    >
      {children}
    </DashboardShell>
  );
}
