/**
 * Seed database MicroRAD — user dibuat EKSPLISIT di bawah (bukan dari
 * mock): 5 user sistem (admin + manager) & 2 user portal (pelanggan),
 * semua dengan password default. Data domain (customer/profil/router/
 * sesi/invoice) dipetakan dari mock agar tampilan identik.
 *
 * Jalankan: bun prisma/seed.ts  (atau `bunx prisma db seed`)
 */

import { hashPassword } from "@better-auth/utils/password";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import { initialInvoices, initialPayments } from "../src/lib/mock/billing.mock";
import { initialCustomers } from "../src/lib/mock/customers.mock";
import { getGlobalLogs } from "../src/lib/mock/global-logs";
import {
  getPortalLoginLogs,
  getPortalSessionLogs,
} from "../src/lib/mock/portal-logs";
import { initialProfiles } from "../src/lib/mock/profiles.mock";
import { relMonthsAgoIso, relNowIso } from "../src/lib/mock/relative-dates";
import { initialRoles } from "../src/lib/mock/roles.mock";
import { initialRouters } from "../src/lib/mock/routers.mock";
import { initialSessions } from "../src/lib/mock/sessions.mock";
import { initialCompanyProfile } from "../src/lib/mock/settings.mock";

const databaseUrl = process.env.DATABASE_URL ?? "";
const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

/** Password default semua akun seed — hash scrypt format Better Auth */
const SEED_PASSWORD = "password123";
const PASSWORD_HASH = await hashPassword(SEED_PASSWORD);

/**
 * Resolve string tanggal relatif mock ("relNowIso(0,14)" /
 * "relMonthsAgoIso(7,8,30)") menjadi Date absolut.
 */
function resolveDate(value?: string | null): Date | null {
  if (!value) return null;
  const months = value.match(/^relMonthsAgoIso\(([\d.]+),\s*(\d+),\s*(\d+)\)$/);
  if (months) {
    return new Date(
      relMonthsAgoIso(Number(months[1]), Number(months[2]), Number(months[3])),
    );
  }
  const nowMatch = value.match(/^relNowIso\((\d+),\s*(\d+)(?:,\s*(\d+))?\)$/);
  if (nowMatch) {
    return new Date(
      relNowIso(
        Number(nowMatch[1]),
        Number(nowMatch[2]),
        Number(nowMatch[3] ?? 0),
      ),
    );
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function main() {
  console.log("⏳ Seeding database MicroRAD...");

  // ── Bersihkan (urutan: child dulu) ───────────────────────────────
  await prisma.paymentRecord.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.session.deleteMany();
  await prisma.portalSessionLog.deleteMany();
  await prisma.portalLoginLog.deleteMany();
  await prisma.globalLog.deleteMany();
  await prisma.portalAccount.deleteMany();
  await prisma.portalSession.deleteMany();
  await prisma.portalVerification.deleteMany();
  await prisma.portalUser.deleteMany();
  await prisma.appAccount.deleteMany();
  await prisma.appSession.deleteMany();
  await prisma.appVerification.deleteMany();
  await prisma.appUser.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.nasRouter.deleteMany();
  await prisma.bandwidthProfile.deleteMany();
  await prisma.role.deleteMany();
  await prisma.companyProfile.deleteMany();
  await prisma.waTemplate.deleteMany();

  // ── 1. Roles (RBAC) — TANPA role-customer (user sistem & portal dipisah) ──
  const roles = initialRoles.filter((r) => r.id !== "role-customer");
  for (const role of roles) {
    await prisma.role.create({
      data: {
        id: role.id,
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        system: role.system,
        createdAt: new Date(role.createdAt),
        updatedAt: new Date(role.updatedAt),
      },
    });
  }
  console.log(`✓ ${roles.length} role (tanpa role-customer)`);

  // ── 2. Bandwidth Profiles ──
  for (const p of initialProfiles) {
    await prisma.bandwidthProfile.create({
      data: {
        id: p.id,
        name: p.name,
        rateLimitDown: p.rateLimitDown,
        rateLimitUp: p.rateLimitUp,
        price: p.price,
      },
    });
  }
  console.log(`✓ ${initialProfiles.length} profil bandwidth`);

  // ── 3. Router NAS ──
  for (const r of initialRouters) {
    await prisma.nasRouter.create({
      data: {
        id: r.id,
        name: r.name,
        ipAddress: r.ipAddress,
        location: r.location,
        type: r.type,
        status: r.status,
      },
    });
  }
  console.log(`✓ ${initialRouters.length} router NAS`);

  // ── 4. Customers (tanggal dire-resolve) ──
  for (const c of initialCustomers) {
    await prisma.customer.create({
      data: {
        id: c.id,
        username: c.username,
        password: c.password,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        address: c.address,
        status: c.status,
        profileId: c.profileId,
        staticIp: c.staticIp,
        nasId: c.nasId,
        createdAt: resolveDate(c.createdAt) ?? new Date(),
        updatedAt: resolveDate(c.updatedAt) ?? new Date(),
        lastSeenAt: resolveDate(c.lastSeenAt),
        currentSessionId: c.currentSessionId,
      },
    });
  }
  console.log(`✓ ${initialCustomers.length} pelanggan`);

  // ── 5. Sessions ──
  for (const s of initialSessions) {
    await prisma.session.create({
      data: {
        id: s.id,
        customerId: s.customerId,
        customerUsername: s.customerUsername,
        nasId: s.nasId,
        nasIpAddress: s.nasIpAddress,
        framedIp: s.framedIp,
        startedAt: new Date(s.startedAt),
        stoppedAt: s.stoppedAt ? new Date(s.stoppedAt) : null,
        durationSeconds: s.durationSeconds,
        inputBytes: BigInt(Math.round(s.inputBytes)),
        outputBytes: BigInt(Math.round(s.outputBytes)),
        terminateCause: s.terminateCause,
      },
    });
  }
  console.log(`✓ ${initialSessions.length} sesi PPPoE`);

  // ── 6. App Users (sistem) — didefinisikan EKSPLISIT (bukan dari mock) ──
  // Semua akun: password default "password123" (hash scrypt Better Auth).
  const appUsers = [
    {
      id: "usr-1",
      name: "Ahmad Sanjaya (Admin)",
      email: "admin@microrad.net",
      role: "admin",
      roleId: "role-admin",
      status: "active",
    },
    {
      id: "usr-2",
      name: "Rian Hendrawan (NOC)",
      email: "operator@microrad.net",
      role: "operator",
      roleId: "role-manager",
      status: "active",
    },
    {
      id: "usr-3",
      name: "Bima Santosa (Field Tech)",
      email: "tech@microrad.net",
      role: "operator",
      roleId: "role-manager",
      status: "active",
    },
    {
      id: "usr-4",
      name: "Siti Sarah (Disabled Account)",
      email: "siti.old@microrad.net",
      role: "operator",
      roleId: "role-manager",
      status: "disabled",
    },
    {
      id: "usr-10",
      name: "Dina Kartika (Finance)",
      email: "finance@microrad.net",
      role: "operator",
      roleId: "role-manager",
      status: "active",
    },
    {
      id: "usr-11",
      name: "Andi Pratama (Manager)",
      email: "manager@microrad.net",
      role: "operator",
      roleId: "role-manager",
      status: "active",
    },
  ] as const;

  for (const u of appUsers) {
    await prisma.appUser.create({
      data: {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role === "admin" ? "admin" : "operator",
        roleId: u.roleId,
        status: u.status,
        accounts: {
          create: {
            id: `acc-${u.id}-credential`,
            accountId: u.email,
            providerId: "credential",
            password: PASSWORD_HASH,
          },
        },
      },
    });
  }
  console.log(`✓ ${appUsers.length} user sistem (eksplisit)`);

  // ── 7. Portal Users (pelanggan) — didefinisikan EKSPLISIT ──
  const portalUsers = [
    {
      id: "usr-cust-1",
      name: "Budi Santoso",
      email: "budi.santoso@mail.com",
      customerId: "cust-1",
    },
    {
      id: "usr-cust-2",
      name: "Siti Rahmawati",
      email: "siti.rahma@mail.com",
      customerId: "cust-2",
    },
  ] as const;

  for (const u of portalUsers) {
    await prisma.portalUser.create({
      data: {
        id: u.id,
        name: u.name,
        email: u.email,
        customerId: u.customerId,
        accounts: {
          create: {
            id: `pacc-${u.id}-credential`,
            accountId: u.email,
            providerId: "credential",
            password: PASSWORD_HASH,
          },
        },
      },
    });
  }
  console.log(`✓ ${portalUsers.length} user portal (eksplisit)`);

  // ── 8. Invoices ──
  // Catatan: seed mock memakai snapshot username/nama yang TIDAK sama dgn
  // tabel customers (mis. inv-003 "hendra_k"). FK customerId tetap menunjuk
  // pelanggan nyata (cust-3..7) — kolom snapshot mengikuti invoice mock supaya
  // tampilan UI identik (keputusan direkam di AGENTS.md / plan).
  const customers = await prisma.customer.findMany();
  for (const inv of initialInvoices) {
    await prisma.invoice.create({
      data: {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customerUsername: inv.customerUsername,
        customerFullName: inv.customerFullName,
        customerPhone: inv.customerPhone,
        customerAddress: inv.customerAddress,
        profileId: inv.profileId,
        profileName: inv.profileName,
        periodMonth: inv.periodMonth,
        periodYear: inv.periodYear,
        subtotal: inv.subtotal,
        tax: inv.tax,
        discount: inv.discount,
        adminFee: inv.adminFee,
        installationFee: inv.installationFee,
        taxPercent: inv.taxPercent,
        totalAmount: inv.totalAmount,
        status: inv.status,
        issueDate: new Date(inv.issueDate),
        dueDate: new Date(inv.dueDate),
        paidAt: inv.paidAt ? new Date(inv.paidAt) : null,
        paymentMethod: inv.paymentMethod,
        paymentReference: inv.paymentReference,
        notes: inv.notes,
        createdAt: new Date(inv.createdAt),
        updatedAt: new Date(inv.updatedAt),
      },
    });
  }
  console.log(`✓ ${initialInvoices.length} invoice`);

  // ── 9. Payments ──
  for (const p of initialPayments) {
    await prisma.paymentRecord.create({
      data: {
        id: p.id,
        invoiceId: p.invoiceId,
        invoiceNumber: p.invoiceNumber,
        customerId: p.customerId,
        customerName: p.customerName,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        paymentReference: p.paymentReference,
        paidAt: new Date(p.paidAt),
        receivedBy: p.receivedBy,
        notes: p.notes,
      },
    });
  }
  console.log(`✓ ${initialPayments.length} pembayaran`);

  // ── 10. Company Profile ──
  await prisma.companyProfile.create({
    data: {
      id: 1,
      brandName: initialCompanyProfile.brandName,
      fullName: initialCompanyProfile.fullName,
      address: initialCompanyProfile.address,
      phone: initialCompanyProfile.phone,
      email: initialCompanyProfile.email,
      website: initialCompanyProfile.website,
      npwp: initialCompanyProfile.npwp,
      licenseNo: initialCompanyProfile.licenseNo,
      updatedAt: new Date(initialCompanyProfile.updatedAt ?? new Date()),
    },
  });
  console.log("✓ profil perusahaan");

  // ── 11. Global Logs (deterministik dari mock) ──
  const seedAppUsers = appUsers.map((u) => ({
    id: u.id,
    name: u.name,
    status: u.status,
  }));
  const globalLogs = getGlobalLogs(
    seedAppUsers as Parameters<typeof getGlobalLogs>[0],
  );
  for (const log of globalLogs) {
    await prisma.globalLog.create({
      data: {
        id: log.id,
        timestamp: new Date(log.timestamp),
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        userName: log.userName,
        source: log.source,
      },
    });
  }
  console.log(`✓ ${globalLogs.length} log global`);

  // ── 12. Portal logs (login + sesi) untuk cust-1 & cust-2 ──
  const portalCustomerIds = portalUsers.map((u) => u.customerId);
  for (const customerId of portalCustomerIds) {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) continue;
    const mockCustomer = initialCustomers.find((c) => c.id === customerId);
    if (!mockCustomer) continue;

    const loginLogs = getPortalLoginLogs(mockCustomer);
    for (const log of loginLogs) {
      await prisma.portalLoginLog.create({
        data: {
          id: `${log.id}-seed`,
          customerId: customer.id,
          customerUsername: customer.username,
          loginAt: new Date(log.loginAt),
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          source: log.source ?? "portal",
        },
      });
    }

    const customerSessions = initialSessions.filter(
      (s) => s.customerId === customerId,
    );
    const sessionLogs = getPortalSessionLogs(mockCustomer, customerSessions);
    for (const log of sessionLogs) {
      await prisma.portalSessionLog.create({
        data: {
          id: `${log.id}-seed`,
          customerId: customer.id,
          customerUsername: customer.username,
          nasIpAddress: log.nasIpAddress,
          framedIp: log.framedIp,
          startedAt: new Date(log.startedAt),
          stoppedAt: log.stoppedAt ? new Date(log.stoppedAt) : null,
          durationSeconds: log.durationSeconds,
          inputBytes: BigInt(Math.round(log.inputBytes)),
          outputBytes: BigInt(Math.round(log.outputBytes)),
          terminateCause: log.terminateCause,
        },
      });
    }
  }
  console.log("✓ log portal (cust-1 & cust-2)");

  // ── 13. WA Template (tidak dihapus saat reset) ──
  // Default template sama seperti reminder-dialog.tsx.
  await prisma.waTemplate.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      template:
        "Halo Kak *$USER*,\n\nIni adalah pengingat tagihan internet PPPoE ($PROFILE) untuk periode *$PERIOD* sebesar *$TOTAL*.\n\nNomor Tagihan: *$INVOICE*\nJatuh Tempo: *$DUE*\n\nSilakan lakukan pembayaran melalui QRIS / Transfer Bank / Loket Kasir. Terima kasih! 🙏",
    },
  });
  console.log("✓ template WA");

  console.log("\n✅ Seed selesai.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
