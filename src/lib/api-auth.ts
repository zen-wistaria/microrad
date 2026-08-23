import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "./auth";
import { authPortal } from "./auth-portal";
import { prisma } from "./prisma";
import type { Permission } from "./types";

/**
 * Sumber login — hanya 2 label yang dipakai UI:
 *  "Aplikasi" (user sistem / admin) dan "Portal Langganan" (portal pelanggan).
 *  "API" dicadangkan untuk akses sistem/simulation di masa depan.
 */
export const LOG_SOURCE_APP = "Aplikasi";
export const LOG_SOURCE_PORTAL = "Portal Langganan";
export const LOG_SOURCE_API = "API";

/** Catat login user sistem → GlobalLog (sumber "Aplikasi") */
export async function recordAppLogin(user: {
  id: string;
  name: string;
  email: string;
}) {
  const ua = await getUserAgent();
  await prisma.globalLog.create({
    data: {
      id: `log-app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date(),
      ipAddress: ua.ip,
      userAgent: ua.ua,
      userName: user.name,
      source: LOG_SOURCE_APP,
    },
  });
}

/** Catat login portal pelanggan → PortalLoginLog + GlobalLog (sumber "Portal Langganan") */
export async function recordPortalLogin(userId: string) {
  const portalUser = await prisma.portalUser.findUnique({
    where: { id: userId },
    select: { id: true, customerId: true, name: true },
  });
  if (!portalUser?.customerId) return;
  const customer = await prisma.customer.findUnique({
    where: { id: portalUser.customerId },
    select: { id: true, username: true, fullName: true },
  });
  const ua = await getUserAgent();
  // Catat ke PortalLoginLog + GlobalLog (nama = customer, sumber "Portal Langganan")
  await prisma.portalLoginLog.create({
    data: {
      id: `plog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      customerId: portalUser.customerId,
      customerUsername: customer?.username ?? "",
      loginAt: new Date(),
      ipAddress: ua.ip,
      userAgent: ua.ua,
      source: LOG_SOURCE_PORTAL,
    },
  });
  if (customer) {
    await prisma.globalLog.create({
      data: {
        id: `log-portal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date(),
        ipAddress: ua.ip,
        userAgent: ua.ua,
        userName: customer.fullName || customer.username,
        source: LOG_SOURCE_PORTAL,
      },
    });
  }
}

async function getUserAgent(): Promise<{ ip: string; ua: string }> {
  try {
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
    const ua = h.get("user-agent") ?? "";
    return { ip, ua };
  } catch {
    return { ip: "", ua: "" };
  }
}

/** Error API dengan status HTTP — dilempar handler, ditangkap asyncApi */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Bungkus handler: tangkap ApiError → JSON { error } dengan status */
export function asyncApi<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse | Response>,
) {
  return (...args: Args) =>
    handler(...args).catch((err: unknown) => {
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: err.message },
          { status: err.status },
        );
      }
      console.error("[api] unexpected error:", err);
      return NextResponse.json(
        { error: "Terjadi kesalahan pada server." },
        { status: 500 },
      );
    });
}

/** Wajib sesi user sistem (instance #1) → 401 kalau tidak ada */
export async function requireSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new ApiError(401, "Tidak terautentikasi");
  return session;
}

/** Wajib sesi portal (instance #2) → 401 kalau tidak ada */
export async function requirePortalSession() {
  const session = await authPortal.api.getSession({
    headers: await headers(),
  });
  if (!session) throw new ApiError(401, "Tidak terautentikasi");
  const portalUser = await prisma.portalUser.findUnique({
    where: { id: session.user.id },
    select: { customer: { select: { status: true } } },
  });
  if (portalUser?.customer?.status === "disabled") {
    throw new ApiError(
      403,
      "Akun pelanggan Anda telah dinonaktifkan (Disabled). Akses portal ditutup.",
    );
  }
  return session;
}

/**
 * Wajib permission tertentu (RBAC). Role role-admin → selalu boleh.
 * Role lain harus memuat permission di daftarnya.
 */
export async function requirePermission(permission: Permission) {
  const { user } = await requireSession();
  const dbUser = await prisma.appUser.findUnique({
    where: { id: user.id },
    select: { roleId: true, role: true, status: true },
  });
  if (!dbUser || dbUser.status === "disabled") {
    throw new ApiError(
      403,
      "Akun Anda telah dinonaktifkan. Silakan hubungi administrator.",
    );
  }
  const roleId = dbUser.roleId ?? "";
  const role = roleId
    ? await prisma.role.findUnique({ where: { id: roleId } })
    : null;
  if (role?.id === "role-admin") return user;
  if (role?.permissions.includes(permission)) return user;
  throw new ApiError(
    403,
    "Anda tidak memiliki izin untuk melakukan tindakan ini",
  );
}
