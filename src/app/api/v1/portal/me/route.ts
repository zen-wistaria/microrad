import { NextResponse } from "next/server";
import { asyncApi, requirePortalSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  getRadacctHistory,
  radacctHistoryRowToSession,
} from "@/lib/radacct-sessions";
import {
  getMonthlyUsageFromSessions,
  getUsageHistoryFromSessions,
} from "@/lib/usage-real";

/**
 * GET /api/v1/portal/me — agregat data pelanggan yang login (sesi portal).
 * Kontrak: {customer, profile, summary, usageHistory, invoices, payments,
 *           sessions, loginLogs, sessionLogs}
 */
export const GET = asyncApi(async () => {
  const portalSession = await requirePortalSession();
  const portalUser = portalSession.user;

  const portalAccount = await prisma.portalUser.findUnique({
    where: { id: portalUser.id },
    select: { customerId: true },
  });
  const customerId = portalAccount?.customerId;
  if (!customerId) {
    throw new Error("Data pelanggan tidak ditemukan untuk akun ini.");
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });
  if (!customer) {
    throw new Error("Data pelanggan tidak ditemukan untuk akun ini.");
  }

  const [profile, invoices, payments, sessions, loginLogs] = await Promise.all([
    customer.profileId
      ? prisma.bandwidthProfile.findUnique({
          where: { id: customer.profileId },
        })
      : Promise.resolve(null),
    prisma.invoice.findMany({
      where: { customerId },
      orderBy: { issueDate: "desc" },
    }),
    prisma.paymentRecord.findMany({
      where: { customerId },
      orderBy: { paidAt: "desc" },
    }),
    // History sesi (online + selesai) dari radacct — sumber kebenaran
    getRadacctHistory({ username: customer.username, limit: 500 }).then(
      (rows) => rows.map((r) => radacctHistoryRowToSession(r)),
    ),
    prisma.portalLoginLog.findMany({
      where: { customerId },
      orderBy: { loginAt: "desc" },
      take: 50,
    }),
  ]);

  // Summary + riwayat penggunaan (30 hari) + bulanan 12 bulan berjalan
  // (agregasi sesi nyata — akun baru tanpa sesi = 0)
  const [usageHistory, monthlyUsage] = await Promise.all([
    getUsageHistoryFromSessions(prisma, customerId),
    getMonthlyUsageFromSessions(prisma, customerId),
  ]);
  const totalDownload = usageHistory.reduce((a, p) => a + p.downloadBytes, 0);
  const totalUpload = usageHistory.reduce((a, p) => a + p.uploadBytes, 0);
  const activeInvoices = invoices.filter(
    (i) => i.status === "unpaid" || i.status === "overdue",
  );
  const totalOutstanding = activeInvoices.reduce(
    (a, i) => a + i.totalAmount,
    0,
  );
  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const totalPaid = paidInvoices.reduce((a, i) => a + i.totalAmount, 0);
  const onlineNow = sessions.some((s) => !s.stoppedAt);

  const summary = {
    totalUsage30dBytes: totalDownload + totalUpload,
    totalDownload30dBytes: totalDownload,
    totalUpload30dBytes: totalUpload,
    onlineSessionCount: sessions.filter((s) => !s.stoppedAt).length,
    onlineNow,
    totalPaidAmount: totalPaid,
    totalOutstandingAmount: totalOutstanding,
    activeInvoiceCount: activeInvoices.length,
  };

  // Serialisasi tanggal vs tipe frontend (string ISO)
  const serializeInv = (i: {
    issueDate: Date;
    dueDate: Date;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    [key: string]: unknown;
  }) => ({
    ...i,
    issueDate: i.issueDate.toISOString(),
    dueDate: i.dueDate.toISOString(),
    paidAt: i.paidAt ? i.paidAt.toISOString() : undefined,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  });

  return NextResponse.json({
    data: {
      customer: {
        ...customer,
        createdAt: customer.createdAt.toISOString(),
        updatedAt: customer.updatedAt.toISOString(),
        lastSeenAt: customer.lastSeenAt
          ? customer.lastSeenAt.toISOString()
          : undefined,
      },
      profile,
      summary,
      usageHistory,
      monthlyUsage,
      invoices: invoices.map(serializeInv),
      payments: payments.map((p) => ({
        ...p,
        paidAt: p.paidAt.toISOString(),
      })),
      sessions: sessions.map((s) => ({
        ...s,
        startedAt: s.startedAt,
        stoppedAt: s.stoppedAt,
        inputBytes: s.inputBytes,
        outputBytes: s.outputBytes,
      })),
      loginLogs: loginLogs.map((l) => ({
        ...l,
        loginAt: l.loginAt.toISOString(),
      })),
      sessionLogs: sessions.map((s) => ({
        id: `plog-sess-${s.id}`,
        customerId,
        customerUsername: s.customerUsername,
        startedAt: s.startedAt,
        stoppedAt: s.stoppedAt,
        durationSeconds: s.durationSeconds,
        inputBytes: s.inputBytes,
        outputBytes: s.outputBytes,
        nasIpAddress: s.nasIpAddress,
        framedIp: s.framedIp,
        terminateCause: s.terminateCause,
      })),
    },
  });
});
