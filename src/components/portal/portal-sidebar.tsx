"use client";

import {
  Activity,
  Home,
  LogOut,
  Radio,
  Receipt,
  ScrollText,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoutDialog } from "@/components/common/logout-dialog";
import { Button } from "@/components/ui/button";
import { portalSignOut } from "@/lib/auth-portal-client";

interface PortalSidebarProps {
  customerName?: string;
  online?: boolean;
  onItemClick?: () => void;
  className?: string;
  appName?: string;
}

const NAV_ITEMS = [
  { title: "Informasi Pelanggan", href: "/portal", icon: Home, exact: true },
  { title: "Pemakaian", href: "/portal/usage", icon: Activity },
  { title: "Tagihan", href: "/portal/billing", icon: Receipt },
  { title: "Pembayaran", href: "/portal/payments", icon: Wallet },
  { title: "Log", href: "/portal/logs", icon: ScrollText },
];

export function PortalSidebar({
  customerName,
  online = false,
  onItemClick,
  className = "",
  appName,
}: PortalSidebarProps) {
  const pathname = usePathname();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const handleConfirmLogout = async () => {
    try {
      await portalSignOut();
    } catch {
      // ignore
    }
    if (typeof window !== "undefined") {
      window.location.href = "/portal/login";
    }
  };

  return (
    <aside
      className={`flex h-full w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/95 ${className}`}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-200/80 px-6 dark:border-slate-800/80">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-tr from-emerald-500 to-teal-600 text-white shadow-md">
          <Radio className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
            <span>{appName}</span>
            <span className="rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
              Portal
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Pelanggan PPPoE
          </p>
        </div>
      </div>

      {/* Status pelanggan */}
      <div className="border-b border-slate-200/80 px-4 py-3 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              online ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
            }`}
          />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {online ? "Sedang Online" : "Offline"}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {customerName || "Pelanggan"}
        </p>
      </div>

      {/* Navigasi */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-emerald-50 text-emerald-600 font-semibold dark:bg-emerald-950/50 dark:text-emerald-400"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-slate-200/80 p-3 dark:border-slate-800/80">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400"
          onClick={() => setLogoutDialogOpen(true)}
        >
          <LogOut className="h-4 w-4" />
          Keluar
        </Button>
      </div>

      <LogoutDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={handleConfirmLogout}
        title="Konfirmasi Keluar Portal"
        description="Apakah Anda yakin ingin keluar dari Customer Self-Care? Anda perlu login kembali untuk mengakses layanan."
      />
    </aside>
  );
}
