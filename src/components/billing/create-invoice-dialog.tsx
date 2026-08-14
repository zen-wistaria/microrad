"use client";

import { Calculator, Loader2, PlusCircle } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
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
import { createInvoice } from "@/lib/api/billing";
import type { BandwidthProfile, Customer, Invoice } from "@/lib/types";
import { formatRupiah, getErrorMessage } from "@/lib/utils";

interface CreateInvoiceDialogProps {
  customers: Customer[];
  profiles: BandwidthProfile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newInvoice: Invoice) => void;
}

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function CreateInvoiceDialog({
  customers,
  profiles,
  open,
  onOpenChange,
  onSuccess,
}: CreateInvoiceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [subtotal, setSubtotal] = useState<number>(0);
  const [adminFee, setAdminFee] = useState<number>(2500);
  const [tax, setTax] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, _setNotes] = useState<string>("");

  const handleSelectCustomer = useCallback(
    (cId: string) => {
      setCustomerId(cId);
      const selected = customers.find((c) => c.id === cId);
      if (selected) {
        const profile = profiles.find((p) => p.id === selected.profileId);
        setSubtotal(profile?.price ?? 0);
      }
    },
    [customers, profiles],
  );

  useEffect(() => {
    if (open) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      setMonth(currentMonth);
      setYear(currentYear);

      // Default due date: 10th of this month
      const dueStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}-10`;
      setDueDate(dueStr);

      if (customers.length > 0 && !customerId) {
        handleSelectCustomer(customers[0].id);
      }
    }
  }, [open, customers, customerId, handleSelectCustomer]);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedProfile = profiles.find(
    (p) => p.id === selectedCustomer?.profileId,
  );

  const totalAmount = Math.max(0, subtotal + adminFee + tax - discount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      toast.error("Pilih pelanggan terlebih dahulu.");
      return;
    }
    if (!dueDate) {
      toast.error("Tentukan tanggal jatuh tempo.");
      return;
    }

    try {
      setLoading(true);
      const dueISO = new Date(`${dueDate}T23:59:59Z`).toISOString();
      const issueISO = new Date().toISOString();

      const created = await createInvoice({
        customerId: selectedCustomer.id,
        customerUsername: selectedCustomer.username,
        customerFullName: selectedCustomer.fullName,
        customerPhone: selectedCustomer.phone,
        customerAddress: selectedCustomer.address,
        profileId: selectedCustomer.profileId,
        profileName: selectedProfile?.name || "Paket Standar",
        periodMonth: month,
        periodYear: year,
        subtotal,
        tax,
        discount,
        adminFee,
        totalAmount,
        status: "unpaid",
        issueDate: issueISO,
        dueDate: dueISO,
        notes: notes.trim() || undefined,
      });

      toast.success(`Invoice ${created.invoiceNumber} berhasil dibuat!`);
      onSuccess(created);
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal membuat invoice");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <PlusCircle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Buat Tagihan Baru (Manual)
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Terbitkan tagihan internet PPPoE untuk pelanggan perorangan /
                  instansi.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs sm:text-sm">
            {/* Customer Select */}
            <div className="space-y-1.5">
              <Label htmlFor="inv-customer">Pilih Pelanggan</Label>
              <Select value={customerId} onValueChange={handleSelectCustomer}>
                <SelectTrigger id="inv-customer" className="h-9">
                  <SelectValue placeholder="Pilih Pelanggan..." />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.username} {c.fullName ? `• ${c.fullName}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period Month & Year */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-month">Bulan Periode</Label>
                <Select
                  value={String(month)}
                  onValueChange={(v) => setMonth(Number(v))}
                >
                  <SelectTrigger id="inv-month" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((name, idx) => (
                      <SelectItem key={idx} value={String(idx + 1)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-year">Tahun</Label>
                <Input
                  id="inv-year"
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="h-9"
                />
              </div>
            </div>

            {/* Price breakdown */}
            <div className="space-y-1.5">
              <Label htmlFor="inv-subtotal">Tarif Pokok Paket (Rp)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="inv-subtotal"
                  type="number"
                  min={0}
                  value={subtotal}
                  onChange={(e) => setSubtotal(Number(e.target.value))}
                  className="h-9"
                />
                {selectedProfile?.price ? (
                  <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                    Auto: {formatRupiah(selectedProfile.price)}
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-slate-400">
                Terisi otomatis dari harga paket di{" "}
                <Link
                  href="/profiles"
                  className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400"
                >
                  Profil Bandwidth
                </Link>
                .
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-admin">Biaya Admin / Payment (Rp)</Label>
                <Input
                  id="inv-admin"
                  type="number"
                  min={0}
                  value={adminFee}
                  onChange={(e) => setAdminFee(Number(e.target.value))}
                  className="h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-tax">Pajak / PPN (Rp)</Label>
                <Input
                  id="inv-tax"
                  type="number"
                  value={tax}
                  onChange={(e) => setTax(Number(e.target.value))}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-discount">Potongan / Diskon (Rp)</Label>
                <Input
                  id="inv-discount"
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="h-9"
                />
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <Label htmlFor="inv-due-date">Tanggal Jatuh Tempo</Label>
              <Input
                id="inv-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Total Calculation summary banner */}
            <div className="flex items-center justify-between rounded-xl bg-blue-50/80 p-3.5 border border-blue-100 dark:bg-blue-950/40 dark:border-blue-900/50">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                <Calculator className="h-4 w-4" />
                <span className="font-semibold text-xs">Total Tagihan:</span>
              </div>
              <span className="text-base font-bold text-blue-700 dark:text-blue-300">
                {formatRupiah(totalAmount)}
              </span>
            </div>
          </div>

          <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
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
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5 shadow-sm"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Tagihan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
