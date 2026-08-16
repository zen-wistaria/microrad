import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "./auth";
import { authPortal } from "./auth-portal";
import { prisma } from "./prisma";
import type { Permission } from "./types";

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
    select: { roleId: true, role: true },
  });
  const roleId = dbUser?.roleId ?? "";
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
