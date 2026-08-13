"use client";

import { Check, Copy, ExternalLink, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Invoice } from "@/lib/types";
import { formatDate, formatRupiah } from "@/lib/utils";

interface ReminderDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReminderDialog({
  invoice,
  open,
  onOpenChange,
}: ReminderDialogProps) {
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (invoice) {
      const formattedTotal = formatRupiah(invoice.totalAmount);
      const dueDateFormatted = formatDate(invoice.dueDate);
      const customerName = invoice.customerFullName || invoice.customerUsername;

      const text = `Halo Kak *${customerName}*,\n\nKami dari layanan Internet MicroRAD menginformasikan bahwa tagihan internet PPPoE (${invoice.profileName}) untuk periode *Bulan ${invoice.periodMonth}/${invoice.periodYear}* sebesar *${formattedTotal}* sudah diterbitkan.\n\n📄 Nomor Tagihan: *${invoice.invoiceNumber}*\n📅 Batas Jatuh Tempo: *${dueDateFormatted}*\n\n💳 Pembayaran dapat melalui:\n- QRIS (BCA, Gopay, OVO, ShopeePay, Dana)\n- Transfer BCA: 123-456-7890 a/n MicroRAD Internet\n- Loket Kasir ISP\n\nMohon lakukan pembayaran sebelum jatuh tempo agar koneksi internet tetap lancar. Terima kasih! 🙏`;
      setMessage(text);
      setCopied(false);
    }
  }, [invoice]);

  if (!invoice) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success("Teks pengingat WhatsApp berhasil disalin!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    let cleanPhone = (invoice.customerPhone || "").replace(/\D/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = `62${cleanPhone.slice(1)}`;
    }
    const encoded = encodeURIComponent(message);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Kirim Pengingat Tagihan (WhatsApp)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Kirim pesan tagihan otomatis ke{" "}
                {invoice.customerFullName || invoice.customerUsername} (
                {invoice.customerPhone || "Tanpa Nomor"})
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="wa-message" className="text-xs">
                Template Pesan WhatsApp
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleCopy}
                className="h-7 text-xs gap-1 text-slate-600 dark:text-slate-400"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span>Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Salin Teks</span>
                  </>
                )}
              </Button>
            </div>
            <textarea
              id="wa-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-mono leading-relaxed text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:bg-slate-900"
            />
          </div>
        </div>

        <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Tutup
          </Button>
          <Button
            type="button"
            onClick={handleCopy}
            variant="secondary"
            className="gap-1.5"
          >
            <Copy className="h-4 w-4" />
            Salin Pesan
          </Button>
          <Button
            type="button"
            onClick={handleOpenWhatsApp}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
          >
            <ExternalLink className="h-4 w-4" />
            Buka WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
