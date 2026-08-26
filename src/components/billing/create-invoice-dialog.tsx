"use client";

import { Calculator, Loader2, PlusCircle } from "lucide-react";
import Link from "next/link";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
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
import { getDueDateFromPeriod } from "@/lib/api/billing";
import { useCreateInvoiceMutation } from "@/lib/api/hooks";
import type { Customer, InternetProfile, Invoice } from "@/lib/types";
import { formatRupiah, getErrorMessage } from "@/lib/utils";

export interface InvoiceFormValues {
  customerId: string;
  customerUsername: string;
  customerFullName?: string;
  customerPhone?: string;
  customerAddress?: string;
  profileId: string;
  profileName: string;
  month: number;
  year: number;
  subtotal: number;
  tax: number;
  taxPercent: number;
  discount: number;
  adminFee: number;
  installationFee: number;
  totalAmount: number;
  dueDate: string;
  notes?: string;
}

interface CreateInvoiceDialogProps {
  customers: Customer[];
  profiles: InternetProfile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (invoice: Invoice, values: InvoiceFormValues) => void;
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
  const createInvoiceMutation = useCreateInvoiceMutation();
  const loading = createInvoiceMutation.isPending;

  const [customerId, setCustomerId] = useState("");
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [subtotal, setSubtotal] = useState<number>(0);
  const [adminFee, setAdminFee] = useState<number>(2500);
  const [taxPercent, setTaxPercent] = useState<number>(11);
  const [discount, setDiscount] = useState<number>(0);
  const [installationFee, setInstallationFee] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, _setNotes] = useState<string>("");
  const [duplicateConfirm, setDuplicateConfirm] = useState(false);
  const [duplicateTarget, setDuplicateTarget] = useState<{
    month: number;
    year: number;
  } | null>(null);

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

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const selectedProfile = profiles.find(
    (p) => p.id === selectedCustomer?.profileId,
  );

  // Jatuh tempo otomatis: periode + 1 bulan.
  // (mis. periode Agustus 2026 → jatuh tempo September 2026; hari memakai
  // tanggal registrasi pelanggan, fallback ke 10.)
  const autoDueDate =
    selectedCustomer && year > 0 && month >= 1 && month <= 12
      ? getDueDateFromPeriod(year, month, selectedCustomer.createdAt)
      : "";

  useEffect(() => {
    if (open) {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      setMonth(currentMonth);
      setYear(currentYear);

      if (customers.length > 0 && !customerId) {
        handleSelectCustomer(customers[0].id);
      }
    }
  }, [open, customers, customerId, handleSelectCustomer]);

  useEffect(() => {
    if (open && autoDueDate) {
      setDueDate(autoDueDate.slice(0, 10));
    }
  }, [open, autoDueDate]);

  // Persentase PPN (0-100) → nominal Rupiah dihitung dari subtotal.
  const safeTaxPercent = Math.min(100, Math.max(0, taxPercent || 0));
  const taxAmount = Math.round((subtotal * safeTaxPercent) / 100);

  const totalAmount = Math.max(
    0,
    subtotal + taxAmount + adminFee + installationFee - discount,
  );

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
    if (taxPercent < 0 || taxPercent > 100) {
      toast.error("PPN hanya boleh diisi antara 0% sampai 100%.");
      return;
    }

    // Validasi duplikat: pelanggan belum boleh punya tagihan di bulan ini
    // (periode sama dengan bulan jatuh tempo yang sedang dibuat).
    const targetMonth = month;
    const targetYear = year;
    try {
      const { getInvoices } = await import("@/lib/api/billing");
      const allInvoices = await getInvoices();
      const hasDup = allInvoices.some(
        (inv) =>
          inv.customerId === selectedCustomer.id &&
          inv.periodYear === targetYear &&
          inv.periodMonth === targetMonth,
      );
      if (hasDup) {
        setDuplicateTarget({ month: targetMonth, year: targetYear });
        setDuplicateConfirm(true);
        return;
      }
    } catch {
      // kalau cek gagal, biarkan API createInvoice yang menolak
    }

    try {
      const dueISO = new Date(`${dueDate}T23:59:59Z`).toISOString();

      const created = await createInvoiceMutation.mutateAsync({
        customerId: selectedCustomer.id,
        customerUsername: selectedCustomer.username,
        customerFullName: selectedCustomer.fullName ?? undefined,
        customerPhone: selectedCustomer.phone ?? undefined,
        customerAddress: selectedCustomer.address ?? undefined,
        profileId: selectedCustomer.profileId,
        profileName: selectedProfile?.name || "Paket Standar",
        periodMonth: month,
        periodYear: year,
        subtotal,
        tax: taxAmount,
        taxPercent: safeTaxPercent,
        discount,
        adminFee,
        installationFee,
        totalAmount,
        status: "unpaid",
        issueDate: new Date().toISOString(),
        dueDate: dueISO,
        notes: notes.trim() || undefined,
      });

      toast.success(`Invoice ${created.invoiceNumber} berhasil dibuat!`);
      onSuccess(created, {
        customerId: selectedCustomer.id,
        customerUsername: selectedCustomer.username,
        customerFullName: selectedCustomer.fullName ?? undefined,
        customerPhone: selectedCustomer.phone ?? undefined,
        customerAddress: selectedCustomer.address ?? undefined,
        profileId: selectedCustomer.profileId,
        profileName: selectedProfile?.name || "Paket Standar",
        month,
        year,
        subtotal,
        tax: taxAmount,
        taxPercent: safeTaxPercent,
        discount,
        adminFee,
        installationFee,
        totalAmount,
        dueDate,
        notes: notes.trim() || undefined,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal membuat invoice");
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
                <Label htmlFor="inv-tax-percent">PPN (%)</Label>
                <Input
                  id="inv-tax-percent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(Number(e.target.value))}
                  className="h-9"
                />
                <p className="text-[11px] text-slate-400">
                  Persentase PPN; maksimal 100%. ({formatRupiah(taxAmount)})
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inv-discount">Potongan / Diskon (Rp)</Label>
                <Input
                  id="inv-discount"
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="h-9"
                />
              </div>
            </div>

            {/* Installation fee */}
            <div className="space-y-1.5">
              <Label htmlFor="inv-installation">
                Biaya Instalasi (Rp, default 0)
              </Label>
              <Input
                id="inv-installation"
                type="number"
                min={0}
                value={installationFee}
                onChange={(e) => setInstallationFee(Number(e.target.value))}
                className="h-9"
                placeholder="0"
              />
            </div>

            {/* Due Date — otomatis dari tanggal registrasi pelanggan */}
            <div className="space-y-1.5">
              <Label htmlFor="inv-due-date">Tanggal Jatuh Tempo</Label>
              <Input
                id="inv-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9"
              />
              <p className="text-[11px] text-slate-400">
                Otomatis = akhir periode + 1 bulan (hari mengikuti tanggal
                registrasi pelanggan)
                {selectedCustomer
                  ? ` (registrasi tgl ${new Date(selectedCustomer.createdAt).getDate()} — jatuh tempo ${dueDate || "—"})`
                  : "."}
              </p>
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

          {/* Konfirmasi duplikat tagihan periode ini */}
          <ConfirmDialog
            open={duplicateConfirm}
            onOpenChange={(open) => !open && setDuplicateConfirm(false)}
            title="Tagihan Sudah Ada di Periode Ini"
            description={`Pelanggan ${selectedCustomer?.username || ""} sudah memiliki tagihan untuk bulan ${
              duplicateTarget
                ? MONTH_NAMES[duplicateTarget.month - 1]
                : "periode tersebut"
            }${duplicateTarget ? ` ${duplicateTarget.year}` : ""}. Hapus atau lunasi tagihan tersebut terlebih dahulu sebelum membuat tagihan baru.`}
            confirmLabel="Mengerti"
            onConfirm={() => {
              setDuplicateConfirm(false);
              setDuplicateTarget(null);
              onOpenChange(false);
            }}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
