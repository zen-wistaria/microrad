import {
  Activity,
  AlertCircle,
  CheckCircle2,
  FolderKanban,
  ShieldUser,
  User,
  UserCog2,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type {
  AppUserRole,
  AppUserStatus,
  CustomerStatus,
  NasRouterStatus,
} from "@/lib/types";

interface CustomerStatusBadgeProps {
  status: CustomerStatus;
  isOnline?: boolean;
}

export function CustomerStatusBadge({
  status,
  isOnline,
}: CustomerStatusBadgeProps) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {status === "active" && (
        <Badge variant="success" className="font-medium">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Aktif
        </Badge>
      )}
      {status === "suspended" && (
        <Badge variant="warning" className="font-medium">
          <AlertCircle className="h-3 w-3 mr-1" />
          Suspended
        </Badge>
      )}
      {status === "disabled" && (
        <Badge variant="secondary" className="font-medium text-slate-500">
          <XCircle className="h-3 w-3 mr-1" />
          Nonaktif
        </Badge>
      )}

      {isOnline ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Online
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:bg-red-500/20 dark:text-red-400 border border-red-500/30">
          Offline
        </span>
      )}
    </span>
  );
}

export function RouterStatusBadge({ status }: { status: NasRouterStatus }) {
  if (status === "online") {
    return (
      <Badge variant="success" className="font-medium gap-1">
        <Wifi className="h-3 w-3" />
        Online
      </Badge>
    );
  }
  if (status === "online_ping_only") {
    return (
      <Badge variant="warning" className="font-medium gap-1">
        <AlertCircle className="h-3 w-3" />
        Online (Hanya Ping)
      </Badge>
    );
  }
  if (status === "online_api_only") {
    return (
      <Badge variant="info" className="font-medium gap-1">
        <Activity className="h-3 w-3" />
        Online (Hanya API)
      </Badge>
    );
  }
  if (status === "offline") {
    return (
      <Badge variant="destructive" className="font-medium gap-1">
        <WifiOff className="h-3 w-3" />
        Offline
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="font-medium gap-1">
      <AlertCircle className="h-3 w-3" />
      Unknown
    </Badge>
  );
}

export function AppUserRoleBadge({
  role,
  roleId,
}: {
  role: AppUserRole;
  roleId?: string;
}) {
  // Role kustom (bukan bawaan) → tampilkan nama dari API roles
  if (roleId && !["role-admin", "role-manager"].includes(roleId)) {
    return (
      <Badge variant="purple" className="font-medium">
        <UserCog2 className="h-3 w-3 mr-1" />
        Custom
      </Badge>
    );
  }
  if (roleId === "role-manager") {
    return (
      <Badge variant="purple" className="font-medium">
        <FolderKanban className="h-3 w-3 mr-1" />
        Manager
      </Badge>
    );
  }
  if (role === "admin") {
    return (
      <Badge variant="purple" className="font-medium">
        <ShieldUser className="h-3 w-3 mr-1" />
        Admin
      </Badge>
    );
  }
  return (
    <Badge variant="info" className="font-medium">
      <User className="h-3 w-3" />
      Operator
    </Badge>
  );
}

export function AppUserStatusBadge({ status }: { status: AppUserStatus }) {
  if (status === "active") {
    return (
      <Badge variant="success" className="font-medium">
        Aktif
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="font-medium text-slate-500">
      Nonaktif
    </Badge>
  );
}

export function InvoiceStatusBadge({
  status,
}: {
  status: "paid" | "unpaid" | "overdue" | "cancelled";
}) {
  switch (status) {
    case "paid":
      return (
        <Badge variant="success" className="font-medium gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Lunas
        </Badge>
      );
    case "unpaid":
      return (
        <Badge variant="info" className="font-medium gap-1">
          <AlertCircle className="h-3 w-3" />
          Belum Bayar
        </Badge>
      );
    case "overdue":
      return (
        <Badge
          variant="destructive"
          className="font-medium gap-1 animate-pulse-slow"
        >
          <XCircle className="h-3 w-3" />
          Jatuh Tempo
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="secondary" className="font-medium text-slate-500">
          Dibatalkan
        </Badge>
      );
  }
}

export function PaymentMethodBadge({ method }: { method?: string }) {
  if (!method) return <span className="text-slate-400 text-xs">-</span>;
  const labels: Record<string, { label: string; className: string }> = {
    qris: {
      label: "QRIS",
      className:
        "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
    },
    transfer_bca: {
      label: "BCA",
      className:
        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
    },
    transfer_mandiri: {
      label: "Mandiri",
      className:
        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    },
    transfer_bri: {
      label: "BRI",
      className:
        "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    },
    cash: {
      label: "Tunai / Loket",
      className:
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    },
    other: {
      label: "Lainnya",
      className:
        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    },
  };

  const item = labels[method] || {
    label: method,
    className: "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold border ${item.className}`}
    >
      {item.label}
    </span>
  );
}
