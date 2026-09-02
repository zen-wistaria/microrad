import type React from "react";
import { Footer } from "@/components/layout/footer";
import { PortalShell } from "@/components/portal/portal-shell";
import { appConfig } from "@/config/app";

/**
 * Server Component Layout untuk Portal Pelanggan.
 *
 * Mengambil metadata aplikasi (APP_NAME) secara dinamis di server
 * dan menyisipkan Server Component Footer.
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PortalShell appName={appConfig.name} footer={<Footer />}>
      {children}
    </PortalShell>
  );
}
