"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Globe,
  Mail,
  MapPin,
  Phone,
  Printer,
  Send,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PaymentDialog } from "@/components/billing/payment-dialog";
import { ReminderDialog } from "@/components/billing/reminder-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getInvoiceById } from "@/lib/api/billing";
import { getCompanyProfile } from "@/lib/api/settings";
import type { CompanyProfile, Invoice } from "@/lib/types";
import { formatDate, formatRupiah, terbilangRupiah } from "@/lib/utils";

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [company, setCompany] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    const fetchInv = async () => {
      try {
        setLoading(true);
        const [data, profile] = await Promise.all([
          getInvoiceById(id),
          getCompanyProfile(),
        ]);
        setInvoice(data);
        setCompany(profile);
      } catch {
        toast.error("Gagal memuat detail faktur");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchInv();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-150 w-full rounded-2xl" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-slate-500">
          Invoice tidak ditemukan atau telah dihapus.
        </p>
        <Button asChild variant="outline">
          <Link href="/billing">Kembali ke Daftar Billing</Link>
        </Button>
      </div>
    );
  }

  const isPaid = invoice.status === "paid";
  const isOverdue = invoice.status === "overdue";

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 print:m-0 print:p-0 print:max-w-none">
      {/* Print-specific style rules to force pure light theme & exact 1-page layout */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 10mm !important;
          }
          
          html,
          body,
          #__next,
          div[data-nextjs-scroll-focus-boundary] {
            background-color: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Reset sheet for print */
          .invoice-paper-sheet {
            width: 100% !important;
            max-width: 100% !important;
            border: 0px solid #e2e8f0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 20px 24px !important;
            background: transparent !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Force light theme colors on all elements inside invoice even if dark mode is active */
          .dark .invoice-paper-sheet,
          .dark .invoice-paper-sheet * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Text colors in print */
          .dark .invoice-paper-sheet h1,
          .dark .invoice-paper-sheet h2,
          .dark .invoice-paper-sheet h3,
          .dark .invoice-paper-sheet h4,
          .dark .invoice-paper-sheet .text-slate-900,
          .dark .invoice-paper-sheet [class*="text-slate-100"],
          .dark .invoice-paper-sheet [class*="text-slate-200"] {
            color: #0f172a !important;
          }

          .dark .invoice-paper-sheet [class*="text-slate-300"],
          .dark .invoice-paper-sheet .text-slate-800 {
            color: #1e293b !important;
          }

          .dark .invoice-paper-sheet [class*="text-slate-400"],
          .dark .invoice-paper-sheet .text-slate-600,
          .dark .invoice-paper-sheet .text-slate-700 {
            color: #475569 !important;
          }

          .dark .invoice-paper-sheet .text-blue-600,
          .dark .invoice-paper-sheet [class*="text-blue-400"] {
            color: #2563eb !important;
          }

          .dark .invoice-paper-sheet .text-rose-600,
          .dark .invoice-paper-sheet [class*="text-rose-400"],
          .dark .invoice-paper-sheet [class*="text-rose-700"] {
            color: #e11d48 !important;
          }

          .dark .invoice-paper-sheet .text-emerald-600,
          .dark .invoice-paper-sheet [class*="text-emerald-400"],
          .dark .invoice-paper-sheet [class*="text-emerald-700"] {
            color: #059669 !important;
          }

          .dark .invoice-paper-sheet [class*="text-emerald-900"],
          .dark .invoice-paper-sheet [class*="text-emerald-950"],
          .dark .invoice-paper-sheet [class*="text-emerald-200"] {
            color: #064e3b !important;
          }

          /* Background colors in print */
          .dark .invoice-paper-sheet,
          .dark .invoice-paper-sheet [class*="bg-slate-900"],
          .dark .invoice-paper-sheet [class*="bg-slate-950"] {
            background-color: #ffffff !important;
          }

          .dark .invoice-paper-sheet [class*="bg-slate-800"],
          .dark .invoice-paper-sheet [class*="bg-slate-50"] {
            background-color: #f8fafc !important;
          }

          .dark .invoice-paper-sheet [class*="bg-emerald-950"],
          .dark .invoice-paper-sheet [class*="bg-emerald-50"] {
            background-color: #ecfdf5 !important;
          }

          .dark .invoice-paper-sheet [class*="bg-blue-950"],
          .dark .invoice-paper-sheet [class*="bg-blue-50"] {
            background-color: #eff6ff !important;
          }

          .dark .invoice-paper-sheet [class*="bg-amber-950"],
          .dark .invoice-paper-sheet [class*="bg-amber-50"] {
            background-color: #fffbeb !important;
          }

          .dark .invoice-paper-sheet [class*="bg-rose-950"],
          .dark .invoice-paper-sheet [class*="bg-rose-50"] {
            background-color: #fff1f2 !important;
          }

          /* Border colors in print */
          .dark .invoice-paper-sheet [class*="border-slate-800"],
          .dark .invoice-paper-sheet [class*="border-slate-700"],
          .dark .invoice-paper-sheet [class*="border-slate-200"],
          .dark .invoice-paper-sheet [class*="border-slate-100"] {
            border-color: #e2e8f0 !important;
          }

          .dark .invoice-paper-sheet [class*="border-emerald-800"],
          .dark .invoice-paper-sheet [class*="border-emerald-500"],
          .dark .invoice-paper-sheet [class*="border-emerald-300"],
          .dark .invoice-paper-sheet [class*="border-emerald-200"] {
            border-color: #a7f3d0 !important;
          }

          .dark .invoice-paper-sheet [class*="border-blue-900"],
          .dark .invoice-paper-sheet [class*="border-blue-800"],
          .dark .invoice-paper-sheet [class*="border-blue-200"],
          .dark .invoice-paper-sheet [class*="border-blue-100"] {
            border-color: #bfdbfe !important;
          }

          .dark .invoice-paper-sheet [class*="border-amber-500"],
          .dark .invoice-paper-sheet [class*="border-amber-300"] {
            border-color: #fde68a !important;
          }

          .dark .invoice-paper-sheet [class*="border-rose-500"],
          .dark .invoice-paper-sheet [class*="border-rose-300"] {
            border-color: #fecdd3 !important;
          }

          /* Layout structure overrides */
          .force-row {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
          }
          .force-grid-2 {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 16px !important;
          }
          .force-grid-calc {
            display: grid !important;
            grid-template-columns: 7fr 5fr !important;
            gap: 16px !important;
          }
        }
      `}</style>

      {/* Top Action Bar (Hidden during print) */}
      <div className="flex flex-row items-center justify-between gap-4 print:hidden">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
        >
          <Link href="/billing">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Daftar Billing
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          {!isPaid && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReminderOpen(true)}
                className="gap-1.5 text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
              >
                <Send className="h-3.5 w-3.5" />
                Kirim WA
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={() => setPayOpen(true)}
                className="gap-1.5 text-xs font-semibold shadow-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Tandai Lunas
              </Button>
            </>
          )}

          <Button
            variant="default"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" />
            Cetak / Simpan PDF
          </Button>
        </div>
      </div>

      {/* Invoice Document Paper Container (Always keeps 2-column layout on Desktop & Print) */}
      <div className="overflow-x-auto print:overflow-visible">
        <div className="invoice-paper-sheet min-w-[700px] sm:min-w-0 rounded-2xl border border-slate-200 bg-white p-7 sm:p-9 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:text-slate-100 print:text-slate-900 print:bg-white print:border-none print:shadow-none print:p-0 print:rounded-none">
          {/* Header: Company Info (Left) & Invoice Title/Number/Status (Right) */}
          <div className="force-row flex flex-row items-start justify-between gap-6 border-b border-slate-200 pb-5 dark:border-slate-800 print:border-slate-200">
            {/* Left: ISP Details */}
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-base">
                  {(company?.brandName || "M").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="font-extrabold text-lg tracking-tight text-slate-900 dark:text-slate-100 print:text-slate-900 leading-tight">
                    {company?.brandName || "MicroRAD Internet Services"}
                  </h1>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                    {company?.fullName || "PT MicroRAD Broadband Solusindo"}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600 space-y-0.5 leading-tight">
                {company?.address && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                    {company.address}
                  </p>
                )}
                {company?.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                    {company.phone}
                  </p>
                )}
                {company?.email && (
                  <p className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                    {company.email}
                  </p>
                )}
                {company?.website && (
                  <p className="flex items-center gap-1.5">
                    <Globe className="h-3 w-3 text-slate-400 shrink-0" />
                    {company.website}
                  </p>
                )}
                {(company?.npwp || company?.licenseNo) && (
                  <p className="text-[10px] text-slate-400 pt-0.5">
                    {[
                      company.npwp && `NPWP: ${company.npwp}`,
                      company.licenseNo &&
                        `Izin ISP Kominfo No: ${company.licenseNo}`,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                )}
              </div>
            </div>

            {/* Right: Invoice Type & Status Stamp */}
            <div className="text-right space-y-1.5">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Invoice Tagihan Resmi
                </span>
                <h2 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-blue-600 dark:text-blue-400 print:text-blue-600">
                  {invoice.invoiceNumber}
                </h2>
              </div>

              {/* Status Badge */}
              <div className="flex justify-end">
                {isPaid ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50/90 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/50 dark:border-emerald-500 dark:text-emerald-300 print:border-emerald-300 print:bg-emerald-50 print:text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    LUNAS / PAID
                  </div>
                ) : isOverdue ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50/90 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-rose-700 dark:bg-rose-950/50 dark:border-rose-500 dark:text-rose-300 print:border-rose-300 print:bg-rose-50 print:text-rose-700">
                    JATUH TEMPO / OVERDUE
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50/90 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-amber-800 dark:bg-amber-950/50 dark:border-amber-500 dark:text-amber-300 print:border-amber-300 print:bg-amber-50 print:text-amber-800">
                    BELUM LUNAS / UNPAID
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Customer Info & Billing Dates (Always 2 Columns) */}
          <div className="force-grid-2 grid grid-cols-2 gap-4 py-4 border-b border-slate-200 dark:border-slate-800 print:border-slate-200 text-xs">
            {/* Customer Box */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/30 print:border-slate-200 print:bg-slate-50/70 space-y-1">
              <p className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                Ditagihkan Kepada (Pelanggan):
              </p>
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 print:text-slate-900">
                {invoice.customerFullName || invoice.customerUsername}
              </h3>
              <div className="text-[11px] text-slate-600 dark:text-slate-300 print:text-slate-700 space-y-0.5">
                <p>
                  <span className="text-slate-400">Username PPPoE:</span>{" "}
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400 print:text-blue-700">
                    @{invoice.customerUsername}
                  </span>
                </p>
                {invoice.customerPhone && (
                  <p>
                    <span className="text-slate-400">No. WhatsApp/HP:</span>{" "}
                    <span className="font-mono font-medium">
                      {invoice.customerPhone}
                    </span>
                  </p>
                )}
                {invoice.customerAddress && (
                  <p className="pt-0.5 leading-snug">
                    <span className="text-slate-400">Alamat Pasang:</span>{" "}
                    <span>{invoice.customerAddress}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Dates Box */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/30 print:border-slate-200 print:bg-slate-50/70 space-y-1.5">
              <p className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                Rincian Tanggal & Periode:
              </p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className="text-slate-400 text-[10px]">Tanggal Terbit:</p>
                  <p className="font-semibold text-slate-800 dark:text-slate-200 print:text-slate-900">
                    {formatDate(invoice.issueDate)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px]">
                    Batas Jatuh Tempo:
                  </p>
                  <p className="font-bold text-rose-600 dark:text-rose-400 print:text-rose-700">
                    {formatDate(invoice.dueDate)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px]">
                    Periode Pemakaian:
                  </p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 print:text-slate-900">
                    Bulan {invoice.periodMonth} / {invoice.periodYear}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-[10px]">Metode / Status:</p>
                  <p className="font-semibold uppercase text-slate-800 dark:text-slate-200 print:text-slate-900">
                    {invoice.paymentMethod || "QRIS"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="py-4">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600 uppercase text-[10px] font-bold tracking-wider dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700 print:bg-slate-50 print:text-slate-800 print:border-slate-200">
                  <th className="py-2 px-3 w-10 text-center">NO</th>
                  <th className="py-2 px-3">
                    RINCIAN LAYANAN / PAKET INTERNET
                  </th>
                  <th className="py-2 px-3 text-center w-24">DURASI</th>
                  <th className="py-2 px-3 text-right w-28">TARIF SATUAN</th>
                  <th className="py-2 px-3 text-right w-32">TOTAL (IDR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 print:divide-slate-100">
                {/* Item 1: Main Internet Subscription */}
                <tr>
                  <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                    1
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900 dark:text-slate-100 print:text-slate-900">
                      Layanan Internet Dedicated / Broadband PPPoE
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Paket:{" "}
                      <span className="font-semibold text-slate-600 dark:text-slate-300 print:text-slate-700">
                        {invoice.profileName}
                      </span>{" "}
                      • Unlimited FUP Kuota
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-600 dark:text-slate-400 print:text-slate-700">
                    1 Bulan
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300 print:text-slate-800">
                    {formatRupiah(invoice.subtotal)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 print:text-slate-900">
                    {formatRupiah(invoice.subtotal)}
                  </td>
                </tr>

                {/* Item 2: Admin fee (if any) */}
                {invoice.adminFee > 0 && (
                  <tr>
                    <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">
                      2
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200 print:text-slate-900">
                        Biaya Administrasi & Pemeliharaan Jaringan
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Payment gateway fee & network support
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center text-slate-500">-</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600 print:text-slate-700">
                      {formatRupiah(invoice.adminFee)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200 print:text-slate-900">
                      {formatRupiah(invoice.adminFee)}
                    </td>
                  </tr>
                )}

                {/* Item 3: Tax / PPN (if any) */}
                {invoice.tax > 0 && (
                  <tr>
                    <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">
                      {invoice.adminFee > 0 ? 3 : 2}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200 print:text-slate-900">
                        PPN (Pajak Pertambahan Nilai 11%)
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center text-slate-500">-</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-600 print:text-slate-700">
                      {formatRupiah(invoice.tax)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200 print:text-slate-900">
                      {formatRupiah(invoice.tax)}
                    </td>
                  </tr>
                )}

                {/* Item 4: Discount (if any) */}
                {invoice.discount > 0 && (
                  <tr className="text-emerald-600 dark:text-emerald-400 print:text-emerald-700">
                    <td className="py-2 px-3 text-center font-mono text-[11px]">
                      #
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold">
                        Potongan Harga Promo / Diskon
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center">-</td>
                    <td className="py-2 px-3 text-right font-mono">
                      -{formatRupiah(invoice.discount)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold">
                      -{formatRupiah(invoice.discount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Calculation & Terbilang Block (Always 2 columns) */}
          <div className="force-grid-calc grid grid-cols-12 gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 print:border-slate-200">
            {/* Left: Terbilang & Notes (7 cols) */}
            <div className="col-span-7 space-y-2.5">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/30 print:border-slate-200 print:bg-slate-50/80">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  TERBILANG (AMOUNT IN WORDS):
                </p>
                <p className="mt-0.5 text-xs font-semibold italic text-slate-800 dark:text-slate-200 print:text-slate-900">
                  &ldquo;{terbilangRupiah(invoice.totalAmount)}&rdquo;
                </p>
              </div>

              <div className="text-[10px] text-slate-500 dark:text-slate-400 print:text-slate-600 leading-tight space-y-0.5">
                <p className="font-semibold text-slate-700 dark:text-slate-300 print:text-slate-800">
                  Ketentuan Pembayaran:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-[10px]">
                  <li>
                    Pembayaran jatuh tempo setiap tanggal yang tertera pada
                    faktur.
                  </li>
                  <li>
                    Keterlambatan pembayaran dapat menyebabkan isolir akun
                    secara otomatis.
                  </li>
                  <li>
                    Simpan bukti transfer dan faktur ini sebagai dokumen
                    pembayaran resmi.
                  </li>
                </ul>
              </div>
            </div>

            {/* Right: Subtotal Calculation & Grand Total (5 cols) */}
            <div className="col-span-5 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400 print:text-slate-700 text-[11px]">
                <span>Subtotal Layanan:</span>
                <span className="font-mono font-medium">
                  {formatRupiah(invoice.subtotal)}
                </span>
              </div>

              {invoice.adminFee > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400 print:text-slate-700 text-[11px]">
                  <span>Biaya Admin & Transaksi:</span>
                  <span className="font-mono font-medium">
                    {formatRupiah(invoice.adminFee)}
                  </span>
                </div>
              )}

              {invoice.tax > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400 print:text-slate-700 text-[11px]">
                  <span>Pajak (PPN 11%):</span>
                  <span className="font-mono font-medium">
                    {formatRupiah(invoice.tax)}
                  </span>
                </div>
              )}

              {invoice.discount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 print:text-emerald-700 text-[11px]">
                  <span>Diskon:</span>
                  <span className="font-mono font-medium">
                    -{formatRupiah(invoice.discount)}
                  </span>
                </div>
              )}

              {/* Grand Total Box */}
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 dark:bg-slate-800/60 dark:border-slate-700 print:bg-slate-50 print:border-slate-200 mt-1">
                <div className="flex justify-between items-center font-bold text-slate-900 dark:text-slate-100 print:text-slate-900">
                  <span className="text-xs uppercase tracking-wider">
                    TOTAL TAGIHAN:
                  </span>
                  <span className="text-base font-black font-mono text-blue-600 dark:text-blue-400 print:text-blue-700">
                    {formatRupiah(invoice.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Confirmation Stamp or Payment Instructions */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 print:border-slate-200">
            {isPaid ? (
              /* Paid Stamp Box */
              <div className="force-row flex flex-row items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20 print:border-emerald-300 print:bg-emerald-50/60">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white font-bold">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="text-xs leading-tight">
                    <p className="font-extrabold text-emerald-900 dark:text-emerald-200 print:text-emerald-950 text-xs">
                      BUKTI PEMBAYARAN SAH (LUNAS)
                    </p>
                    <p className="text-emerald-700 dark:text-emerald-400 print:text-emerald-800 text-[10px]">
                      Dibayar: {formatDate(invoice.paidAt)} • Metode:{" "}
                      <span className="font-semibold uppercase">
                        {invoice.paymentMethod || "QRIS"}
                      </span>
                    </p>
                    <p className="text-emerald-600 dark:text-emerald-400 print:text-emerald-800 font-mono text-[9px]">
                      No. Referensi:{" "}
                      {invoice.paymentReference || "QRIS-8839210492"}
                    </p>
                  </div>
                </div>

                <div className="text-right text-[10px] text-slate-500 dark:text-slate-400 print:text-slate-600">
                  <p className="text-[9px] uppercase tracking-wider text-slate-400">
                    DIVERIFIKASI OLEH:
                  </p>
                  <p className="font-bold text-slate-800 dark:text-slate-200 print:text-slate-900">
                    MicroRAD Finance & Billing System
                  </p>
                  <p className="text-[9px] text-slate-400 italic">
                    Digital Timestamp:{" "}
                    {invoice.paidAt
                      ? formatDate(invoice.paidAt)
                      : formatDate(invoice.issueDate)}
                  </p>
                </div>
              </div>
            ) : (
              /* Unpaid Payment Instruction Box */
              <div className="force-grid-2 grid grid-cols-2 gap-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3 dark:border-blue-900 dark:bg-blue-950/20 print:border-blue-100 print:bg-blue-50/40">
                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-blue-900 dark:text-blue-200 print:text-blue-900 uppercase text-[10px] tracking-wider">
                    1. Transfer Rekening Bank Resmi
                  </h4>
                  <div className="space-y-0.5 text-slate-700 dark:text-slate-300 print:text-slate-800 text-[11px]">
                    <p>
                      BCA:{" "}
                      <span className="font-mono font-bold text-blue-700">
                        123-456-7890
                      </span>{" "}
                      (a.n. PT MicroRAD Broadband)
                    </p>
                    <p>
                      Mandiri:{" "}
                      <span className="font-mono font-bold text-blue-700">
                        123-00-987654-1
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <h4 className="font-bold text-blue-900 dark:text-blue-200 print:text-blue-900 uppercase text-[10px] tracking-wider">
                    2. Pembayaran Instan via QRIS
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Scan via BCA Mobile, Mandiri Livin, GoPay, OVO, Dana,
                    ShopeePay.
                  </p>
                </div>
              </div>
            )}

            {/* Legal Notice */}
            <div className="mt-3 flex flex-row items-center justify-between text-[9px] text-slate-400 print:text-slate-500 border-t border-slate-100 pt-2 dark:border-slate-800 print:border-slate-200">
              <p>
                Dokumen ini diterbitkan secara elektronik oleh MicroRAD Billing
                System dan berlaku sebagai faktur tagihan resmi tanpa tanda
                tangan basah.
              </p>
              <p className="font-mono shrink-0 ml-2">
                Dicetak pada: {formatDate(new Date().toISOString())}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Processing Dialog */}
      <PaymentDialog
        invoice={invoice}
        open={payOpen}
        onOpenChange={setPayOpen}
        onSuccess={(updated) => setInvoice(updated)}
      />

      {/* WhatsApp Reminder Dialog */}
      <ReminderDialog
        invoice={invoice}
        open={reminderOpen}
        onOpenChange={setReminderOpen}
      />
    </div>
  );
}
