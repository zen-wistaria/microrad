"use client";

import { createContext, useContext } from "react";
import type { CustomerPortalData } from "@/lib/api/customer-portal";

export interface PortalContextValue {
  data: CustomerPortalData | null;
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
}

export const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error("usePortal harus dipakai di dalam PortalLayout");
  }
  return ctx;
}
