import type React from "react";

/**
 * Route group portal pelanggan — kerangka minimal.
 * Portal memiliki sesi Better Auth sendiri (instance #2).
 */
export default function PortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
