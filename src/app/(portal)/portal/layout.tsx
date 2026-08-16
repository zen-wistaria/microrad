"use client";

import { Menu, Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { PortalMobileNav } from "@/components/portal/portal-mobile-nav";
import { PortalSidebar } from "@/components/portal/portal-sidebar";
import { Button } from "@/components/ui/button";
import type { CustomerPortalData } from "@/lib/api/customer-portal";
import { getCustomerPortalData } from "@/lib/api/customer-portal";
import { usePortalSession } from "@/lib/auth-portal-client";
import { PortalContext } from "@/lib/portal-context";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: portalSession, isPending } = usePortalSession();
  const [portalData, setPortalData] = useState<CustomerPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!portalSession) return;
    try {
      setRefreshing(true);
      const portal = await getCustomerPortalData();
      setPortalData(portal);
    } catch (err: unknown) {
      console.error("Gagal memuat data portal:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [portalSession]);

  useEffect(() => {
    if (isPending) return;
    // Belum login portal → arahkan ke /login
    if (!portalSession) {
      router.replace("/login");
      return;
    }
    reload();
  }, [isPending, portalSession, reload, router]);

  return (
    <PortalContext.Provider
      value={{ data: portalData, loading, refreshing, reload }}
    >
      <div className="flex h-screen overflow-hidden bg-slate-50/50 dark:bg-slate-950 print:h-auto print:overflow-visible print:bg-white">
        {/* Sidebar Portal (desktop) */}
        <div className="hidden lg:block h-full shrink-0 print:hidden">
          <PortalSidebar
            customerName={portalData?.customer?.fullName}
            online={portalData?.summary?.onlineNow ?? false}
          />
        </div>

        {/* Mobile Drawer */}
        <div className="print:hidden">
          <PortalMobileNav
            open={mobileNavOpen}
            onOpenChange={setMobileNavOpen}
            customerName={portalData?.customer?.fullName}
            online={portalData?.summary?.onlineNow ?? false}
          />
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-y-auto print:overflow-visible print:h-auto print:bg-white">
          {/* Mobile header */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-sm lg:hidden print:hidden dark:border-slate-800/80 dark:bg-slate-900/90">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Buka menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100">
              <Radio className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>MicroRAD Portal</span>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 md:p-8 print:p-0 print:m-0 print:max-w-none">
            <div className="mx-auto max-w-7xl print:max-w-none print:m-0 print:p-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </PortalContext.Provider>
  );
}
