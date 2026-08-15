"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/lib/auth";
import { canAccessRoute } from "@/lib/rbac";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { currentUser, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // RBAC: jika belum login → /login; jika role tidak berhak akses halaman ini
  // → redirect ke halaman awal yang diizinkan.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    if (!canAccessRoute(currentUser, pathname)) {
      if (currentUser?.role === "customer") {
        router.push("/portal");
      } else {
        router.push("/dashboard");
      }
    }
  }, [isAuthenticated, isLoading, pathname, router, currentUser]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-500">
            Memuat MicroRAD PPPoE Manager...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/50 dark:bg-slate-950 print:h-auto print:overflow-visible print:bg-white">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block h-full shrink-0 print:hidden">
        <Sidebar />
      </div>

      {/* Mobile Drawer */}
      <div className="print:hidden">
        <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-y-auto print:overflow-visible print:h-auto print:bg-white">
        <div className="print:hidden">
          <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        </div>
        <main className="flex-1 p-4 sm:p-6 md:p-8 print:p-0 print:m-0 print:max-w-none">
          <div className="mx-auto max-w-7xl print:max-w-none print:m-0 print:p-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
