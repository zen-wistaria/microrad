"use client";

import {
  Activity,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Radio,
  Receipt,
  Router as RouterIcon,
  ScrollText,
  Settings2,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getActiveSessions } from "@/lib/api/sessions";
import { hasPermission } from "@/lib/rbac";
import type { Permission } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";

/** Sysadmin/System Settings item hanya tampil untuk role Admin */
function canShowSystemItem(user: { role?: string } | null): boolean {
  if (!user) return false;
  return user.role === "admin";
}

interface MainNavItem {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
  matchExact?: boolean;
  badgeKey?: "activeSessions";
  /** Permission read yang dibutuhkan (null = semua user non-pelanggan) */
  permission?: Permission;
}

const mainNavItems: MainNavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Pelanggan",
    href: "/customers",
    icon: Users,
    permission: "customer.read",
  },
  {
    title: "Tagihan & Billing",
    href: "/billing",
    icon: Receipt,
    permission: "billing.read",
  },
  {
    title: "Sesi Aktif",
    href: "/sessions",
    icon: Activity,
    badgeKey: "activeSessions",
    permission: "session.read",
  },
  {
    title: "Profil Bandwidth",
    href: "/profiles",
    icon: Zap,
    permission: "profile.read",
  },
  {
    title: "Router NAS",
    href: "/routers",
    icon: RouterIcon,
    permission: "router.read",
  },
];

const systemNavItems = [
  {
    title: "Pengguna Aplikasi",
    href: "/users",
    icon: ShieldCheck,
    permission: "user.read",
  },
  {
    title: "Role & Permissions",
    href: "/roles",
    icon: KeyRound,
  },
  {
    title: "Profil Perusahaan",
    href: "/settings",
    icon: Settings2,
  },
  {
    title: "Log Global",
    href: "/logs",
    icon: ScrollText,
    permission: "log.read",
  },
];

interface SidebarProps {
  className?: string;
  onItemClick?: () => void;
}

export function Sidebar({ className = "", onItemClick }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const [activeSessionCount, setActiveSessionCount] = useState<number>(0);
  const handleLogout = () => {
    logout(); // hapus sesi login (localStorage)
    router.replace("/login"); // langsung redirect ke halaman login
  };

  useEffect(() => {
    let cancelled = false;
    const fetchCounts = async () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      try {
        const sessions = await getActiveSessions();
        if (!cancelled) {
          setActiveSessionCount(sessions.length);
        }
      } catch (_e) {
        // silent fallback
      }
    };

    fetchCounts();
    // Polling santai setiap 60 detik (hanya saat tab aktif)
    const interval = setInterval(fetchCounts, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const isLinkActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  // Menu Manajemen Jaringan — hanya tampil jika user punya permission read
  const visibleMainItems = mainNavItems.filter(
    (item) => !item.permission || hasPermission(currentUser, item.permission),
  );

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/95",
        className,
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 sm:h-18 items-center gap-3 border-b border-slate-200/80 px-6 dark:border-slate-800/80">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
          <Radio className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
            <span>MicroRAD</span>
            <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
              v0.2
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            PPPoE & RADIUS Manager
          </p>
        </div>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {/* Main Section — hanya menu yang user punya permission read-nya */}
        {visibleMainItems.length > 0 && (
          <div className="space-y-1">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Manajemen Jaringan
            </div>
            {visibleMainItems.map((item) => {
              const active = isLinkActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  className={cn(
                    "group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-blue-50 text-blue-600 font-semibold dark:bg-blue-950/50 dark:text-blue-400 shadow-xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300",
                      )}
                    />
                    <span>{item.title}</span>
                  </div>

                  {item.badgeKey === "activeSessions" && (
                    <span
                      className={cn(
                        "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold transition-all",
                        activeSessionCount > 0
                          ? "bg-emerald-500 text-white shadow-xs"
                          : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
                      )}
                    >
                      {activeSessionCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* System Settings Section (Separated visual group) — hanya Admin */}
        {canShowSystemItem(currentUser) && (
          <div className="mt-8 space-y-1">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Pengaturan Sistem
            </div>
            {systemNavItems.map((item) => {
              const active = isLinkActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  className={cn(
                    "group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-purple-50 text-purple-600 font-semibold dark:bg-purple-950/50 dark:text-purple-400"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        active
                          ? "text-purple-600 dark:text-purple-400"
                          : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300",
                      )}
                    />
                    <span>{item.title}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* User Footer Profile */}
      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-purple-500 to-indigo-600 text-xs font-bold text-white">
              {currentUser?.name?.charAt(0) || "U"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                {currentUser?.name || "App User"}
              </p>
              <p className="text-[11px] capitalize text-slate-500 dark:text-slate-400">
                {currentUser?.roleId === "role-manager"
                  ? "Manager"
                  : currentUser?.role || "User"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            title="Keluar"
            className="h-8 w-8 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
