import React from "react";
import { Badge } from "@/components/ui/badge";
import { CustomerStatus, AppUserRole, AppUserStatus } from "@/lib/types";
import { CheckCircle2, AlertCircle, XCircle, Wifi, WifiOff, Shield, User } from "lucide-react";

interface CustomerStatusBadgeProps {
  status: CustomerStatus;
  isOnline?: boolean;
}

export function CustomerStatusBadge({ status, isOnline }: CustomerStatusBadgeProps) {
  return (
    <div className="flex items-center gap-2">
      {status === "active" && (
        <Badge variant="success" className="font-medium">
          <CheckCircle2 className="h-3 w-3" />
          Aktif
        </Badge>
      )}
      {status === "suspended" && (
        <Badge variant="warning" className="font-medium">
          <AlertCircle className="h-3 w-3" />
          Suspended
        </Badge>
      )}
      {status === "disabled" && (
        <Badge variant="secondary" className="font-medium text-slate-500">
          <XCircle className="h-3 w-3" />
          Nonaktif
        </Badge>
      )}

      {isOnline && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Online
        </span>
      )}
    </div>
  );
}

export function RouterStatusBadge({ status }: { status: "online" | "offline" | "unknown" }) {
  if (status === "online") {
    return (
      <Badge variant="success" className="font-medium">
        <Wifi className="h-3 w-3" />
        Online
      </Badge>
    );
  }
  if (status === "offline") {
    return (
      <Badge variant="destructive" className="font-medium">
        <WifiOff className="h-3 w-3" />
        Offline
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="font-medium">
      <AlertCircle className="h-3 w-3" />
      Unknown
    </Badge>
  );
}

export function AppUserRoleBadge({ role }: { role: AppUserRole }) {
  if (role === "admin") {
    return (
      <Badge variant="purple" className="font-medium">
        <Shield className="h-3 w-3" />
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
