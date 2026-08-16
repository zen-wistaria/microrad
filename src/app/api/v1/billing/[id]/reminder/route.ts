import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

/**
 * Kirim pengingat WhatsApp — merender template (WaTemplate / default),
 * mengganti variabel $USER/$BRAND/$PROFILE/$PERIOD/$TOTAL/$INVOICE/$DUE.
 */
export const POST = asyncApi(async (_req: Request, ctx: { params: Params }) => {
  await requirePermission("billing.read");
  const { id } = await ctx.params;
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) throw new Error("Invoice tidak ditemukan.");

  const [company, tpl] = await Promise.all([
    prisma.companyProfile.findUnique({ where: { id: 1 } }),
    prisma.waTemplate.findUnique({ where: { id: 1 } }),
  ]);

  const template =
    tpl?.template ??
    "Halo Kak *$USER*,\n\nIni adalah pengingat tagihan internet PPPoE ($PROFILE) untuk periode *$PERIOD* sebesar *$TOTAL*.\n\nNomor Tagihan: *$INVOICE*\nJatuh Tempo: *$DUE*\n\nSilakan lakukan pembayaran melalui QRIS / Transfer Bank / Loket Kasir. Terima kasih! 🙏";

  const amount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(invoice.totalAmount);
  const period = new Date(
    invoice.periodYear,
    invoice.periodMonth - 1,
    1,
  ).toLocaleDateString("id-ID", { month: "long" });
  const due = new Date(invoice.dueDate).toLocaleDateString("id-ID");

  const text = template
    .replaceAll("$USER", invoice.customerFullName || invoice.customerUsername)
    .replaceAll("$BRAND", company?.brandName ?? "MicroRAD Internet Services")
    .replaceAll("$PROFILE", invoice.profileName)
    .replaceAll("$PERIOD", `Bulan ${period} ${invoice.periodYear}`)
    .replaceAll("$TOTAL", amount)
    .replaceAll("$INVOICE", invoice.invoiceNumber)
    .replaceAll("$DUE", due);

  return NextResponse.json({
    data: {
      success: true,
      message: `Pengingat WhatsApp berhasil dikirim ke ${invoice.customerPhone || "nomor pelanggan"}`,
      phone: invoice.customerPhone,
      text,
    },
  });
});
