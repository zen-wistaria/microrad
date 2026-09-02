"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { cn } from "@/lib/utils";

export interface RouteTabItem {
  label: React.ReactNode;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

interface RouteTabsProps {
  items: RouteTabItem[];
  className?: string;
  listClassName?: string;
}

/**
 * Komponen navigasi tabs berbasis rute Next.js.
 * Memiliki styling yang identik dengan TabsList dan TabsTrigger shadcn/ui.
 */
export function RouteTabs({ items, className, listClassName }: RouteTabsProps) {
  const pathname = usePathname();

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "inline-flex h-9 items-center justify-center rounded-lg bg-slate-100 p-1 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
          listClassName,
        )}
      >
        {items.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs sm:text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive
                  ? "bg-white text-slate-950 shadow-xs dark:bg-slate-900 dark:text-slate-50 font-semibold"
                  : "hover:text-slate-900 dark:hover:text-slate-100",
              )}
            >
              {Icon && (
                <Icon className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              )}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default RouteTabs;
