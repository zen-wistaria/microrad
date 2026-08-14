"use client";

import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { CustomerPortalData } from "@/lib/api/customer-portal";
import { getCustomerPortalData } from "@/lib/api/customer-portal";
import { useAuth } from "@/lib/auth";
import { PortalContext } from "@/lib/portal-context";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser } = useAuth();
  const [data, setData] = useState<CustomerPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    if (!currentUser) return;
    try {
      setRefreshing(true);
      const portal = await getCustomerPortalData(currentUser);
      setData(portal);
    } catch (err: unknown) {
      console.error("Gagal memuat data portal:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <PortalContext.Provider value={{ data, loading, refreshing, reload }}>
      {children}
    </PortalContext.Provider>
  );
}
