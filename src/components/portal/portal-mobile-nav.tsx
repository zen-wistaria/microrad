"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PortalSidebar } from "./portal-sidebar";

interface PortalMobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName?: string;
  online?: boolean;
}

export function PortalMobileNav({
  open,
  onOpenChange,
  customerName,
  online,
}: PortalMobileNavProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed inset-y-0 left-0 z-50 h-full w-72 max-w-xs border-r border-slate-200 bg-white p-0 shadow-2xl transition-all sm:rounded-none dark:border-slate-800 dark:bg-slate-900 translate-x-0 translate-y-0 top-0 left-0">
        <PortalSidebar
          customerName={customerName}
          online={online}
          onItemClick={() => onOpenChange(false)}
          className="w-full border-none"
        />
      </DialogContent>
    </Dialog>
  );
}
