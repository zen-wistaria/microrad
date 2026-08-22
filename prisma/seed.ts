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
import { LOG_SOURCE_APP, LOG_SOURCE_PORTAL } from "../src/lib/api-auth";
import { initialInvoices, initialPayments } from "../src/lib/mock/billing.mock";
import { initialCustomers } from "../src/lib/mock/customers.mock";
import { getGlobalLogs } from "../src/lib/mock/global-logs";
import { getPortalLoginLogs } from "../src/lib/mock/portal-logs";
import { initialProfiles } from "../src/lib/mock/profiles.mock";
import { relMonthsAgoIso, relNowIso } from "../src/lib/mock/relative-dates";
import { initialRoles } from "../src/lib/mock/roles.mock";
import { initialRouters } from "../src/lib/mock/routers.mock";
import { initialCompanyProfile } from "../src/lib/mock/settings.mock";

const databaseUrl = `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
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
  // tabel RADIUS bersama (dikelola app + FreeRADIUS)
  await prisma.radAcct.deleteMany();
  await prisma.radPostAuth.deleteMany();
  await prisma.radCheck.deleteMany();
  await prisma.radReply.deleteMany();
  await prisma.radGroupCheck.deleteMany();
  await prisma.radGroupReply.deleteMany();
  await prisma.radUserGroup.deleteMany();
  await prisma.nas.deleteMany();
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
  await prisma.pppProfile.deleteMany();
  await prisma.profileGroup.deleteMany();
  await prisma.bandwidth.deleteMany();
  await prisma.nasRouter.deleteMany();
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

  // ── 2. Router NAS ──
  for (const r of initialRouters) {
    await prisma.nasRouter.create({
      data: {
        id: r.id,
        name: r.name,
        ipAddress: r.ipAddress,
        location: r.location,
        type: r.type,
        status: "unknown",
        ...(r.id === "nas-1"
          ? {
              apiUsername: "admin",
              apiPassword: "admin",
              apiPort: 8728,
              radiusSecret: "testing123",
            }
          : {}),
      },
    });
  }
  console.log(
    `✓ ${initialRouters.length} router NAS (nas-1 + kredensial demo)`,
  );

  // radsync: daftarkan nas-1 ke tabel `nas` (read_clients FreeRADIUS)
  const nas1 = initialRouters.find((r) => r.id === "nas-1");
  if (nas1) {
    await prisma.nas.upsert({
      where: { nasname: nas1.ipAddress },
      update: {
        shortname: nas1.name,
        type: "mikrotik",
        ports: 1812,
        secret: "testing123",
      },
      create: {
        nasname: nas1.ipAddress,
        shortname: nas1.name,
        type: "mikrotik",
        ports: 1812,
        secret: "testing123",
        description: nas1.location,
      },
    });
  }

  // ── 3. Bandwidth Configurations ──
  const initialBws = [
    { id: "bw-1", name: "5 Mbps Simetris", maxDown: 5, maxUp: 2 },
    { id: "bw-2", name: "10 Mbps Simetris", maxDown: 10, maxUp: 5 },
    { id: "bw-3", name: "20 Mbps Simetris", maxDown: 20, maxUp: 10 },
    { id: "bw-4", name: "50 Mbps Gamer", maxDown: 50, maxUp: 25 },
    { id: "bw-5", name: "100 Mbps Dedicated", maxDown: 100, maxUp: 50 },
  ];
  for (const bw of initialBws) {
    await prisma.bandwidth.create({
      data: {
        id: bw.id,
        name: bw.name,
        maxDownload: bw.maxDown,
        maxDownloadUnit: "Mbps",
        maxUpload: bw.maxUp,
        maxUploadUnit: "Mbps",
      },
    });
  }
  console.log(`✓ ${initialBws.length} konfigurasi bandwidth`);

  // ── 4. Profile Group ──
  const grp1 = await prisma.profileGroup.create({
    data: {
      id: "grp-1",
      name: "Group-MikroTik-Node1",
      nasId: "nas-1",
      type: "PPP",
      ipModule: "sql",
      localAddress: "10.10.10.1",
      rangeIpStart: "10.10.10.2",
      rangeIpEnd: "10.10.10.254",
      dnsServers: "8.8.8.8,8.8.4.4",
    },
  });
  console.log(`✓ 1 Profile Group (${grp1.name})`);

  // ── 5. PPP Profiles ──
  for (const p of initialProfiles) {
    await prisma.pppProfile.create({
      data: {
        id: p.id,
        name: p.name,
        price: p.price,
        profileGroupId: "grp-1",
        bandwidthId: p.bandwidthId || "bw-1",
        priority: p.priority || 8,
      },
    });
  }
  console.log(`✓ ${initialProfiles.length} PPP Profile`);

  // ── 6. Customers (tanggal dire-resolve) ──
  for (const c of initialCustomers) {
    await prisma.customer.create({
      data: {
        id: c.id,
        username: c.username,
        password: c.password ?? null,
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
      },
    });
  }
  console.log(`✓ ${initialCustomers.length} pelanggan`);

  // radsync: radcheck (Cleartext-Password) + radreply (Framed-IP-Address, Mikrotik-Rate-Limit)
  const pppProfiles = await prisma.pppProfile.findMany({
    include: { bandwidth: true },
  });
  const profileMap = new Map(pppProfiles.map((p) => [p.id, p]));
  let radCount = 0;
  for (const c of await prisma.customer.findMany()) {
    const mock = initialCustomers.find((m) => m.id === c.id);
    if (!mock) continue;
    const password =
      mock.username === "budi_santoso" ? "pass123" : "password123";
    if (c.status === "active") {
      await prisma.radCheck.upsert({
        where: {
          username_attribute: {
            username: c.username,
            attribute: "Cleartext-Password",
          },
        },
        update: { value: password, op: ":=" },
        create: {
          username: c.username,
          attribute: "Cleartext-Password",
          op: ":=",
          value: password,
        },
      });
      radCount += 1;
    }
    if (c.staticIp) {
      await prisma.radReply.upsert({
        where: {
          username_attribute: {
            username: c.username,
            attribute: "Framed-IP-Address",
          },
        },
        update: { value: c.staticIp, op: ":=" },
        create: {
          username: c.username,
          attribute: "Framed-IP-Address",
          op: ":=",
          value: c.staticIp,
        },
      });
      radCount += 1;
    }
    const prof = c.profileId ? profileMap.get(c.profileId) : null;
    if (prof?.bandwidth) {
      const rate = `${prof.bandwidth.maxDownload}M/${prof.bandwidth.maxUpload}M`;
      await prisma.radReply.upsert({
        where: {
          username_attribute: {
            username: c.username,
            attribute: "Mikrotik-Rate-Limit",
          },
        },
        update: { value: rate },
        create: {
          username: c.username,
          attribute: "Mikrotik-Rate-Limit",
          op: ":=",
          value: rate,
        },
      });
      radCount += 1;
    }
  }
  console.log(`✓ ${radCount} baris RADIUS (radcheck/radreply)`);

  // ── 6. App Users (sistem) — didefinisikan EKSPLISIT (bukan dari mock) ──
  // Semua akun: password default "password123" (hash scrypt Better Auth).
  const appUsers = [
    {
      id: "usr-1",
      name: "Administrator (NOC)",
      username: "admin",
      email: "admin@microrad.net",
      role: "admin",
      roleId: "role-admin",
      status: "active",
    },
    {
      id: "usr-2",
      name: "Rian Hendrawan (NOC)",
      username: "operator",
      email: "operator@microrad.net",
      role: "operator",
      roleId: "role-manager",
      status: "active",
    },
    {
      id: "usr-3",
      name: "Bima Santosa (Field Tech)",
      username: "tech",
      email: "tech@microrad.net",
      role: "operator",
      roleId: "role-manager",
      status: "active",
    },
    {
      id: "usr-4",
      name: "Siti Sarah (Disabled Account)",
      username: "siti",
      email: "siti.old@microrad.net",
      role: "operator",
      roleId: "role-manager",
      status: "disabled",
    },
    {
      id: "usr-10",
      name: "Dina Kartika (Finance)",
      username: "finance",
      email: "finance@microrad.net",
      role: "operator",
      roleId: "role-manager",
      status: "active",
    },
    {
      id: "usr-11",
      name: "Andi Pratama (Manager)",
      username: "manager",
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
        username: u.username,
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
        // Sumber login: 2 label (Aplikasi / Portal Langganan); "api" → "Aplikasi"
        source: log.source === "api" ? LOG_SOURCE_APP : log.source,
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
          source: log.source === "admin" ? LOG_SOURCE_APP : LOG_SOURCE_PORTAL,
        },
      });
    }
  }

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
