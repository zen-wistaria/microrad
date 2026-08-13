"use client";

import { Loader2, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
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
import { bulkGenerateInvoices } from "@/lib/api/billing";
import type { Customer, Invoice } from "@/lib/types";

interface BulkGenerateDialogProps {
  customers: Customer[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (allInvoices: Invoice[], createdCount: number) => void;
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

export function BulkGenerateDialog({
  customers,
  open,
  onOpenChange,
  onSuccess,
}: BulkGenerateDialogProps) {
  const [loading, setLoading] = useState(false);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dueDay, setDueDay] = useState(10);

  const activeCustomerCount = customers.filter(
    (c) => c.status === "active",
  ).length;

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const res = await bulkGenerateInvoices(month, year, dueDay);
      if (res.createdCount > 0) {
        toast.success(
          `Berhasil membuat ${res.createdCount} tagihan baru untuk periode ${MONTH_NAMES[month - 1]} ${year}.`,
        );
      } else {
        toast.info(
          `Semua pelanggan aktif sudah memiliki tagihan untuk periode ${MONTH_NAMES[month - 1]} ${year}.`,
        );
      }
      onSuccess(res.invoices, res.createdCount);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Gagal melakukan generate tagihan massal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Generate Tagihan Massal
              </DialogTitle>
              <DialogDescription className="text-xs">
                Otomatisasi pembuatan invoice bulanan untuk seluruh pelanggan
                PPPoE aktif.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs sm:text-sm">
          {/* Target Customer Info */}
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
              <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-xs">
                  {activeCustomerCount} Pelanggan Aktif Terdeteksi
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                  Sistem akan otomatis menghitung nominal tagihan berdasarkan
                  harga paket bandwidth masing-masing pelanggan.
                </p>
              </div>
            </div>
          </div>

          {/* Period selector */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-month">Target Bulan</Label>
              <Select
                value={String(month)}
                onValueChange={(v) => setMonth(Number(v))}
              >
                <SelectTrigger id="bulk-month" className="h-9">
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
              <Label htmlFor="bulk-year">Target Tahun</Label>
              <Input
                id="bulk-year"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-9"
              />
            </div>
          </div>

          {/* Due Day */}
          <div className="space-y-1.5">
            <Label htmlFor="bulk-due-day">
              Tanggal Batas Jatuh Tempo (Tiap Bulan)
            </Label>
            <Input
              id="bulk-due-day"
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(Number(e.target.value))}
              placeholder="Contoh: 10"
              className="h-9 font-mono"
            />
            <p className="text-[11px] text-slate-500">
              Semua invoice yang digenerate akan memiliki tanggal jatuh tempo
              tgl {dueDay} {MONTH_NAMES[month - 1]} {year}.
            </p>
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
            type="button"
            onClick={handleGenerate}
            disabled={loading || activeCustomerCount === 0}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-sm"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Mulai Generate Sekarang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
