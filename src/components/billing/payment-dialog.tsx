"use client";

import {
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2,
  QrCode,
} from "lucide-react";
import type React from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePayInvoiceMutation } from "@/lib/api/hooks";
import type { Invoice, PaymentMethod } from "@/lib/types";
import { formatRupiah, getErrorMessage } from "@/lib/utils";

interface PaymentDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (updatedInvoice: Invoice) => void;
}

export function PaymentDialog({
  invoice,
  open,
  onOpenChange,
  onSuccess,
}: PaymentDialogProps) {
  const payInvoiceMutation = usePayInvoiceMutation();
  const loading = payInvoiceMutation.isPending;

  const [method, setMethod] = useState<PaymentMethod>("qris");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (invoice) {
      setMethod("qris");
      setReference(
        `TRX-${invoice.invoiceNumber.replace(/\//g, "-")}-${Date.now().toString().slice(-4)}`,
      );
      setNotes(
        `Pembayaran ${invoice.profileName} - Bulan ${invoice.periodMonth}/${invoice.periodYear}`,
      );
    }
  }, [invoice]);

  if (!invoice) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await payInvoiceMutation.mutateAsync({
        id: invoice.id,
        paymentData: {
          paymentMethod: method,
          paymentReference: reference,
          notes,
          paidAt: new Date().toISOString(),
        },
      });
      toast.success(
        `Tagihan ${invoice.invoiceNumber} berhasil ditandai Lunas!`,
      );
      onSuccess(updated);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal mencatat pembayaran");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Tandai Tagihan Lunas
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {invoice.invoiceNumber} •{" "}
                  {invoice.customerFullName || invoice.customerUsername}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Amount Box */}
          <div className="my-4 rounded-xl bg-slate-50 p-4 border border-slate-200/80 dark:bg-slate-800/60 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Total yang Dibayar
                </p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(invoice.totalAmount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Paket Internet
                </p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {invoice.profileName}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 text-xs sm:text-sm">
            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-method">Metode Pembayaran</Label>
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as PaymentMethod)}
              >
                <SelectTrigger id="payment-method" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="qris">
                    <div className="flex items-center gap-2">
                      <QrCode className="h-4 w-4 text-teal-600" />
                      <span>QRIS (Gopay / OVO / Shopee / Dana / BCA QR)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="transfer_bca">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-600" />
                      <span>Transfer Bank BCA</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="transfer_mandiri">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-amber-600" />
                      <span>Transfer Bank Mandiri</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="transfer_bri">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-sky-600" />
                      <span>Transfer Bank BRI</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="cash">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-emerald-600" />
                      <span>Tunai / Loket Kasir</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-slate-500" />
                      <span>Metode Lainnya</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reference Number */}
            <div className="space-y-1.5">
              <Label htmlFor="ref-no">Nomor Referensi / Bukti Transfer</Label>
              <Input
                id="ref-no"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Contoh: TRF-BCA-1928301"
                className="font-mono text-xs"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Catatan Pembayaran (Opsional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan..."
              />
            </div>
          </div>

          <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={loading}
              className="gap-1.5 shadow-sm"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Konfirmasi Lunas
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
