"use client";

import { LogIn, RefreshCw, Satellite } from "lucide-react";
import type React from "react";
import { RouteTabs } from "@/components/common/route-tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortal } from "@/lib/portal-context";

export default function PortalLogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, loading, refreshing, reload } = usePortal();

  if (loading) {
    return <Skeleton className="h-80 w-full rounded-xl" />;
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-sm text-slate-400">
        Data pelanggan tidak ditemukan untuk akun ini.
      </div>
    );
  }

  const { customer } = data;

  const navTabs = [
    {
      label: "Login",
      href: "/portal/logs/login",
      icon: LogIn,
    },
    {
      label: "Sesi PPPoE",
      href: "/portal/logs/sessions",
      icon: Satellite,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Log Aktivitas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Riwayat login ke portal dan sesi koneksi PPPoE untuk{" "}
            {customer.fullName || customer.username}.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={reload}
          disabled={refreshing}
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Muat Ulang
        </Button>
      </div>

      <RouteTabs items={navTabs} />

      <div>{children}</div>
    </div>
  );
}
