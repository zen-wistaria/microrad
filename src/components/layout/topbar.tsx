"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { initialUsers } from "@/lib/mock/users.mock";
import { resetDemoData } from "@/lib/api/dashboard";
import { toast } from "sonner";
import {
  ChevronRight,
  Menu,
  RotateCcw,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { AppUserRoleBadge } from "../common/status-badge";
import { ThemeToggle } from "../common/theme-toggle";

interface TopbarProps {
  onOpenMobileNav: () => void;
}

const routeTitles: Record<string, string> = {
  dashboard: "Dashboard",
  customers: "Pelanggan PPPoE",
  sessions: "Sesi Aktif",
  profiles: "Profil Bandwidth",
  routers: "Router NAS",
  users: "Pengguna Aplikasi",
  new: "Tambah Baru",
  edit: "Edit Data",
};

export function Topbar({ onOpenMobileNav }: TopbarProps) {
  const pathname = usePathname();
  const { currentUser, login, logout } = useAuth();

  // Generate breadcrumb items
  const pathSegments = pathname.split("/").filter(Boolean);

  const handleResetData = async () => {
    try {
      await resetDemoData();
      toast.success("Data mock berhasil direset ke nilai awal.");
      window.location.reload();
    } catch {
      toast.error("Gagal mereset data");
    }
  };

  const handleSwitchUser = (userId: string) => {
    const user = initialUsers.find((u) => u.id === userId);
    if (user) {
      login(user);
      toast.info(`Beralih akun ke: ${user.name} (${user.role})`);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 sm:h-18 w-full items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 sm:px-8 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80 transition-colors">
      {/* Left: Mobile Nav & Breadcrumbs with spacious layout */}
      <div className="flex items-center gap-4 sm:gap-6">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-10 w-10 text-slate-600 dark:text-slate-400"
          onClick={onOpenMobileNav}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Buka Menu Navigasi</span>
        </Button>

        <nav className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400">
          <Link
            href="/dashboard"
            className="font-semibold text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 transition-colors"
          >
            MicroRAD
          </Link>

          {pathSegments.map((segment, index) => {
            const url = `/${pathSegments.slice(0, index + 1).join("/")}`;
            const isLast = index === pathSegments.length - 1;
            const title = routeTitles[segment] || segment;

            return (
              <React.Fragment key={url}>
                <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                {isLast ? (
                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[160px] sm:max-w-[280px]">
                    {title}
                  </span>
                ) : (
                  <Link
                    href={url}
                    className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                  >
                    {title}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right: Theme Toggle, Quick Tools, and App User Menu */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Reset Demo Data Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetData}
          title="Reset Data Mock ke Nilai Awal"
          className="hidden md:inline-flex text-xs text-slate-600 dark:text-slate-300 gap-1.5 h-9 px-3 rounded-lg border-slate-200 dark:border-slate-700"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset Demo</span>
        </Button>

        {/* Theme Switcher Toggle (Light / Dark / System) */}
        <div className="flex items-center border-l border-slate-200 dark:border-slate-800 pl-3 sm:pl-4">
          <ThemeToggle />
        </div>

        {/* User Account Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-3 px-2.5 py-1.5 h-auto rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-tr from-blue-600 to-indigo-600 text-xs font-bold text-white shadow-sm ring-2 ring-blue-500/20">
                {currentUser?.name?.charAt(0) || "A"}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {currentUser?.name || "Admin"}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {currentUser?.role && <AppUserRoleBadge role={currentUser.role} />}
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 p-1.5 shadow-xl">
            <DropdownMenuLabel className="px-3 py-2">
              <p className="text-xs font-normal text-slate-500 dark:text-slate-400">Masuk sebagai</p>
              <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                {currentUser?.email || "admin@microrad.net"}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-[11px] text-slate-400 font-medium px-3 py-1.5">
              Ganti Akun Cepat (Demo):
            </DropdownMenuLabel>
            {initialUsers.slice(0, 2).map((user) => (
              <DropdownMenuItem
                key={user.id}
                onClick={() => handleSwitchUser(user.id)}
                className="justify-between text-xs px-3 py-2 cursor-pointer rounded-lg"
              >
                <span className="font-medium">{user.name}</span>
                <span className="text-[10px] text-slate-500 uppercase font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  {user.role}
                </span>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleResetData}
              className="text-xs cursor-pointer text-slate-600 dark:text-slate-300 md:hidden px-3 py-2 rounded-lg"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Demo Data
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={logout}
              className="text-xs cursor-pointer text-rose-600 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-400 px-3 py-2 rounded-lg"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Keluar (Logout)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
