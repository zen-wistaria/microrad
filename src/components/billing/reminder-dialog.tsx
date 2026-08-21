"use client";

import {
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  RotateCcw,
} from "lucide-react";
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
import {
  useCompanyProfileQuery,
  useSaveWaTemplateMutation,
  useWaTemplateQuery,
} from "@/lib/api/hooks";
import type { CompanyProfile, Invoice } from "@/lib/types";
import { formatDate, formatRupiah, getErrorMessage } from "@/lib/utils";

interface ReminderDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Template pesan WhatsApp dengan variabel:
 *   $USER  → nama pelanggan (full name, fallback ke username)
 *   $BRAND → nama brand perusahaan (Profil Perusahaan)
 *   $PROFILE → nama paket bandwidth
 *   $PERIOD → periode tagihan, mis. "Bulan Agustus 2026"
 *   $TOTAL → nominal tagihan (Rupiah)
 *   $INVOICE → nomor tagihan
 *   $DUE → tanggal jatuh tempo terformat
 */
const DEFAULT_TEMPLATE = `Halo Kak *$USER*,

Kami dari layanan Internet $BRAND menginformasikan bahwa tagihan internet PPPoE ($PROFILE) untuk periode *$PERIOD* sebesar *$TOTAL* sudah diterbitkan.

📄 Nomor Tagihan: *$INVOICE*
📅 Batas Jatuh Tempo: *$DUE*

💳 Pembayaran dapat melalui:
- QRIS (BCA, Gopay, OVO, ShopeePay, Dana)
- Transfer BCA: 123-456-7890 a/n $BRAND Internet
- Loket Kasir ISP

Mohon lakukan pembayaran sebelum jatuh tempo agar koneksi internet tetap lancar. Terima kasih! 🙏`;

function buildMessage(
  template: string,
  invoice: Invoice,
  brand: CompanyProfile | null,
): string {
  const customerName = invoice.customerFullName || invoice.customerUsername;
  const period = `Bulan ${new Date(invoice.periodYear, invoice.periodMonth - 1, 1).toLocaleDateString("id-ID", { month: "long" })} ${invoice.periodYear}`;
  return template
    .replaceAll("$USER", customerName)
    .replaceAll("$BRAND", brand?.brandName || "MicroRAD")
    .replaceAll("$PROFILE", invoice.profileName || "Paket Standar")
    .replaceAll("$PERIOD", period)
    .replaceAll("$TOTAL", formatRupiah(invoice.totalAmount))
    .replaceAll("$INVOICE", invoice.invoiceNumber)
    .replaceAll("$DUE", formatDate(invoice.dueDate));
}

export function ReminderDialog({
  invoice,
  open,
  onOpenChange,
}: ReminderDialogProps) {
  const { data: brand = null } = useCompanyProfileQuery();
  const { data: remoteTemplate } = useWaTemplateQuery();
  const saveWaTemplateMutation = useSaveWaTemplateMutation();

  const [template, setTemplate] = useState<string>(DEFAULT_TEMPLATE);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (remoteTemplate) {
      setTemplate(remoteTemplate);
    }
  }, [remoteTemplate]);

  useEffect(() => {
    if (!invoice) return;
    setMessage(buildMessage(template, invoice, brand));
    setCopied(false);
    setSaved(false);
  }, [invoice, brand, template]);

  if (!invoice) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success("Teks pengingat WhatsApp berhasil disalin!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveTemplate = async () => {
    try {
      await saveWaTemplateMutation.mutateAsync(template);
      setSaved(true);
      toast.success("Template pesan WhatsApp disimpan.");
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menyimpan template.");
    }
  };

  const handleResetTemplate = () => {
    setTemplate(DEFAULT_TEMPLATE);
    const next = buildMessage(DEFAULT_TEMPLATE, invoice, brand);
    setMessage(next);
    toast.info("Template dikembalikan ke bawaan.");
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
          {/* Template (bisa diedit) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="wa-template" className="text-xs">
                Template Pesan WhatsApp
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={handleResetTemplate}
                  title="Kembalikan template bawaan"
                  className="h-7 w-7 text-slate-500 hover:text-slate-900 p-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleSaveTemplate}
                  className="h-7 text-xs"
                >
                  {saved ? "Tersimpan" : "Simpan Template"}
                </Button>
              </div>
            </div>
            <textarea
              id="wa-template"
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value);
                setMessage(buildMessage(e.target.value, invoice, brand));
              }}
              rows={10}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-mono leading-relaxed text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:bg-slate-900"
            />
            <p className="text-[11px] text-slate-500">
              Variabel:{" "}
              <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">
                $USER
              </code>{" "}
              <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">
                $BRAND
              </code>{" "}
              <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">
                $PROFILE
              </code>{" "}
              <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">
                $PERIOD
              </code>{" "}
              <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">
                $TOTAL
              </code>{" "}
              <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">
                $INVOICE
              </code>{" "}
              <code className="rounded bg-slate-100 px-1 font-mono dark:bg-slate-800">
                $DUE
              </code>
            </p>
          </div>

          {/* Pratinjau hasil (hanya edit template di atas) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="wa-message" className="text-xs">
                Pratinjau Pesan Terkirim
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
              readOnly
              rows={10}
              className="w-full rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 text-xs font-mono leading-relaxed text-slate-800 focus:outline-none dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-slate-200"
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
