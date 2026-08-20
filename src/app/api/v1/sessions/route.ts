import { NextResponse } from "next/server";
import { asyncApi, requirePermission } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getOnlineRadacct, radacctRowToSession } from "@/lib/radacct-sessions";

interface SessionsQuery {
  search?: string;
  router?: string; // nilai = IP address router
  activeOnly?: boolean;
  customerId?: string;
  page?: number;
  limit?: number;
}

export const GET = asyncApi(async (req: Request) => {
  await requirePermission("session.read");
  const url = new URL(req.url);
  const q: SessionsQuery = {
    search: url.searchParams.get("search") || undefined,
    router: url.searchParams.get("router") || undefined,
    activeOnly: url.searchParams.get("activeOnly") === "true",
    customerId: url.searchParams.get("customerId") || undefined,
    page: parseInt(url.searchParams.get("page") || "1", 10),
    limit: parseInt(url.searchParams.get("limit") || "10", 10),
  };

  const safeLimit = Math.min(Math.max(q.limit || 10, 1), 50);
  const safePage = Math.max(q.page || 1, 1);

  // SUMBER: radacct langsung — sesi online selalu akurat dari FreeRADIUS.
  // Tidak bergantung pada poller/tabel session (yang bisa basi).
  const params: { nasIpAddress?: string; username?: string; limit?: number } =
    {};
  if (q.router && q.router !== "all") params.nasIpAddress = q.router;
  if (q.customerId) {
    const cust = await prisma.customer.findUnique({
      where: { id: q.customerId },
      select: { username: true },
    });
    if (cust) params.username = cust.username;
  }
  const online = await getOnlineRadacct(params);

  // Resolve username → customerId (batch) agar link detail valid
  const usernames = Array.from(
    new Set(
      online.map((r) => r.username).filter((u): u is string => Boolean(u)),
    ),
  );
  const customers = usernames.length
    ? await prisma.customer.findMany({
        where: { username: { in: usernames } },
        select: { id: true, username: true, nasId: true },
      })
    : [];
  const custByUsername = new Map(customers.map((c) => [c.username, c]));

  let rows = online.map((r) => {
    const row = radacctRowToSession(r);
    const cust = r.username ? custByUsername.get(r.username) : undefined;
    return {
      ...row,
      customerId: cust?.id ?? null,
      nasId: cust?.nasId ?? row.nasId,
    };
  });

  // Filter tambahan
  if (!q.activeOnly) {
    // default halaman sesi menampilkan hanya online; jika !activeOnly
    // tidak didukung — pertahankan online saja (kontrak UI).
  }
  if (q.search) {
    const needle = q.search.toLowerCase();
    rows = rows.filter((s) =>
      [s.customerUsername, s.framedIp ?? "", s.nasIpAddress]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }

  const total = rows.length;
  const pageRows = rows.slice(
    (safePage - 1) * safeLimit,
    (safePage - 1) * safeLimit + safeLimit,
  );

  return NextResponse.json({
    data: pageRows,
    total,
  });
});

/** POST /api/v1/sessions/[id]/disconnect — kick sesi dari RouterOS.
 * id sesi = `acct-<acctUniqueId>` — dicari di radacct, lalu kick via API
 * RouterOS (best-effort). FreeRADIUS menerima Stop → hilang dari online. */
export const POST = asyncApi(async (req: Request) => {
  await requirePermission("session.update");
  const url = new URL(req.url);
  const id = url.pathname.split("/")[4] ?? "";
  const acctId = id.startsWith("acct-") ? id.slice(5) : null;
  if (!acctId) {
    throw new Error("Sesi tidak dikenali.");
  }
  const acct = await prisma.radAcct.findUnique({
    where: { acctUniqueId: acctId },
  });
  if (!acct || acct.acctStopTime) {
    throw new Error("Gagal memutuskan sesi PPPoE atau sesi sudah berakhir.");
  }
  const customer = acct.username
    ? await prisma.customer.findUnique({
        where: { username: acct.username },
        select: { nasId: true, username: true },
      })
    : null;
  const { kickSessionByUsername } = await import("@/lib/mikrotik-disconnect");
  await kickSessionByUsername(
    customer?.username ?? acct.username ?? "",
    customer?.nasId ?? null,
  );
  return NextResponse.json({ success: true });
});
