import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { kickSessionByUsername } from "@/lib/mikrotik-disconnect";
import { prisma } from "@/lib/prisma";
import { removeCustomerRadius, syncCustomerRadius } from "@/lib/radsync";

type BulkCustomerAction =
  | "activate"
  | "disconnect"
  | "suspend"
  | "disable"
  | "delete";

interface BulkCustomerBody {
  action: BulkCustomerAction;
  customerIds: string[];
}

export const POST = asyncApi(async (req: Request) => {
  const body = (await req.json()) as BulkCustomerBody;
  const { action, customerIds } = body;

  if (!action || !Array.isArray(customerIds) || customerIds.length === 0) {
    throw new Error("Aksi dan daftar pelanggan wajib disertakan.");
  }

  if (action === "delete") {
    await requirePermission("customer.delete");
  } else {
    await requirePermission("customer.update");
  }

  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    include: {
      profile: { include: { bandwidth: true } },
      profileGroup: {
        include: {
          pppProfiles: { include: { nasRouter: true } },
        },
      },
      portalUser: true,
    },
  });

  if (customers.length === 0) {
    return NextResponse.json({
      success: true,
      message: "Tidak ada pelanggan yang diproses.",
      count: 0,
    });
  }

  // 1. DISCONNECT
  if (action === "disconnect") {
    let disconnectedCount = 0;
    const { sendDisconnect } = await import("@/lib/radius-coa");

    for (const customer of customers) {
      const online = await prisma.radAcct.findFirst({
        where: { username: customer.username, acctStopTime: null },
        orderBy: { acctStartTime: "desc" },
      });

      if (online) {
        const coaResult = await sendDisconnect(customer.username, {
          acctSessionId: online.acctSessionId ?? undefined,
        });

        if (!coaResult.success) {
          await kickSessionByUsername(customer.username, customer.nasId);
        }
        disconnectedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `${disconnectedCount} pelanggan aktif berhasil diputuskan koneksinya.`,
      count: disconnectedCount,
    });
  }

  // 2. ACTIVATE
  if (action === "activate") {
    await prisma.$transaction(async (tx) => {
      for (const customer of customers) {
        const updated = await tx.customer.update({
          where: { id: customer.id },
          data: { status: "active" },
        });

        const sqlNode =
          customer.profileGroup?.pppProfiles.find(
            (p) => p.ipModule === "sql",
          ) ?? customer.profileGroup?.pppProfiles[0];
        const poolName = sqlNode?.ipModule === "sql" ? sqlNode.name : null;
        const nasIp =
          customer.profileGroup?.pppProfiles[0]?.nasRouter?.ipAddress;

        await syncCustomerRadius(
          tx,
          { ...updated, poolName },
          customer.profile
            ? {
                bandwidth: customer.profile.bandwidth,
                priority: customer.profile.priority,
                dnsServers: sqlNode?.dnsServers,
                poolName,
              }
            : null,
          customer.password ?? undefined,
          nasIp,
        );
      }
    });

    return NextResponse.json({
      success: true,
      message: `${customers.length} pelanggan berhasil diaktifkan kembali.`,
      count: customers.length,
    });
  }

  // 3. SUSPEND / DISABLE
  if (action === "suspend" || action === "disable") {
    const newStatus = action === "suspend" ? "suspended" : "disabled";

    await prisma.$transaction(async (tx) => {
      for (const customer of customers) {
        const updated = await tx.customer.update({
          where: { id: customer.id },
          data: { status: newStatus },
        });

        const sqlNode =
          customer.profileGroup?.pppProfiles.find(
            (p) => p.ipModule === "sql",
          ) ?? customer.profileGroup?.pppProfiles[0];
        const poolName = sqlNode?.ipModule === "sql" ? sqlNode.name : null;
        const nasIp =
          customer.profileGroup?.pppProfiles[0]?.nasRouter?.ipAddress;

        await syncCustomerRadius(
          tx,
          { ...updated, poolName },
          customer.profile
            ? {
                bandwidth: customer.profile.bandwidth,
                priority: customer.profile.priority,
                dnsServers: sqlNode?.dnsServers,
                poolName,
              }
            : null,
          customer.password ?? undefined,
          nasIp,
        );

        if (action === "disable" && customer.portalUser) {
          await tx.portalSession.deleteMany({
            where: { userId: customer.portalUser.id },
          });
        }
      }
    });

    // Putus sesi online untuk pelanggan yang baru di-suspend/disable
    const { sendDisconnect } = await import("@/lib/radius-coa");
    for (const customer of customers) {
      const online = await prisma.radAcct.findFirst({
        where: { username: customer.username, acctStopTime: null },
      });
      if (online) {
        const coaResult = await sendDisconnect(customer.username, {
          acctSessionId: online.acctSessionId ?? undefined,
        });
        if (!coaResult.success) {
          await kickSessionByUsername(customer.username, customer.nasId);
        }
      }
    }

    const actionLabel = action === "suspend" ? "disuspend" : "dinonaktifkan";
    return NextResponse.json({
      success: true,
      message: `${customers.length} pelanggan berhasil ${actionLabel}.`,
      count: customers.length,
    });
  }

  // 4. DELETE
  if (action === "delete") {
    // 1. Putus sesi online terlebih dahulu jika ada di radacct
    const { sendDisconnect } = await import("@/lib/radius-coa");
    for (const customer of customers) {
      try {
        const online = await prisma.radAcct.findFirst({
          where: { username: customer.username, acctStopTime: null },
        });
        if (online) {
          const coaResult = await sendDisconnect(customer.username, {
            acctSessionId: online.acctSessionId ?? undefined,
          });
          if (!coaResult.success) {
            await kickSessionByUsername(customer.username, customer.nasId);
          }
        }
      } catch (e) {
        console.warn(`[bulk-delete] Gagal putus sesi ${customer.username}:`, e);
      }
    }

    // 2. Eksekusi hapus di transaksi database
    await prisma.$transaction(async (tx) => {
      for (const customer of customers) {
        // Hapus baris RADIUS (radcheck, radreply, radusergroup, radnasallow)
        await removeCustomerRadius(tx, customer.username);

        // Lepas alokasi IP pool di radippool jika ada
        await tx.radIpPool.updateMany({
          where: { username: customer.username },
          data: {
            username: "",
            callingStationId: "",
            expiryTime: null,
          },
        });

        // Hapus relasi portal user
        const portalUsers = await tx.portalUser.findMany({
          where: { customerId: customer.id },
        });
        for (const pUser of portalUsers) {
          await tx.portalSession.deleteMany({ where: { userId: pUser.id } });
          await tx.portalAccount.deleteMany({ where: { userId: pUser.id } });
          await tx.portalUser.delete({ where: { id: pUser.id } });
        }

        // Hapus log portal
        await tx.portalLoginLog.deleteMany({
          where: { customerId: customer.id },
        });
        await tx.portalSessionLog.deleteMany({
          where: { customerId: customer.id },
        });

        // Hapus payment records dan invoices
        await tx.paymentRecord.deleteMany({
          where: { customerId: customer.id },
        });
        await tx.invoice.deleteMany({
          where: { customerId: customer.id },
        });

        // Hapus data customer
        await tx.customer.delete({
          where: { id: customer.id },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: `${customers.length} pelanggan berhasil dihapus.`,
      count: customers.length,
    });
  }

  throw new Error("Aksi tidak dikenali.");
});
