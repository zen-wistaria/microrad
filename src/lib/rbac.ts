import type { AppUser, Permission, Role } from "./types";

export const RESOURCE_KEYS = [
  "customer",
  "billing",
  "session",
  "profile",
  "router",
  "user",
] as const;
export type ResourceKey = (typeof RESOURCE_KEYS)[number];

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  customer: "Pelanggan",
  billing: "Tagihan & Pembayaran",
  session: "Sesi PPPoE",
  profile: "Profil Bandwidth",
  router: "Router NAS",
  user: "Pengguna Aplikasi",
};

/** Route (/dashboard/...) yang boleh diakses oleh pelanggan */
export const CUSTOMER_ROUTES = ["/portal"];

/**
 * Cek akses rute. Administrator selalu boleh; selain itu periksa
 * role pelanggan (hanya /portal) atau permission "read" modul terkait.
 */
export function canAccessRoute(
  user: AppUser | null,
  pathname: string,
): boolean {
  if (!user) return false;
  const role = getUserRoleById(user.roleId);

  // Role Pelanggan: HANYA /portal (dan sub-halamannya)
  if (role?.id === "role-customer") {
    return CUSTOMER_ROUTES.some(
      (r) => pathname === r || pathname.startsWith(`${r}/`),
    );
  }

  // Administrator: akses penuh, KECUALI /portal (khusus pelanggan)
  if (role?.id === "role-admin") {
    return !pathname.startsWith("/portal");
  }

  // Halaman admin-only: kelola role (RBAC) & pengaturan sistem
  if (pathname.startsWith("/roles") || pathname.startsWith("/settings")) {
    return false;
  }

  // Log Global — butuh permission log.read
  if (pathname.startsWith("/logs")) {
    return hasPermission(user, "log.read");
  }

  // Rute mutasi (create/update/delete) — butuh permission aksinya
  const mutation = routeMutation(pathname);
  if (mutation) return hasPermission(user, mutation);

  const key = routeToResource(pathname);
  if (!key) return true; // halaman umum (dashboard, dll.)
  return hasPermission(user, `${key}.read` as Permission);
}

/** Peta rute mutasi → permission yang dibutuhkan (selain .read) */
function routeMutation(pathname: string): Permission | null {
  const parts = pathname.split("/").filter(Boolean);
  const resource = parts[0];
  if (resource === "customers") {
    // /customers/new → create; /customers/:id/edit → update; selain itu null
    if (parts[1] === "new") return "customer.create";
    if (parts[2] === "edit") return "customer.update";
    return null;
  }
  if (resource === "profiles") {
    if (parts[1] === "new") return "profile.create";
    if (parts[2] === "edit") return "profile.update";
    return null;
  }
  if (resource === "routers") {
    if (parts[1] === "new") return "router.create";
    if (parts[2] === "edit") return "router.update";
    return null;
  }
  if (resource === "users") {
    if (parts[1] === "new") return "user.create";
    if (parts[2] === "edit") return "user.update";
    return null;
  }
  if (resource === "billing") {
    // /billing/new → create (tidak ada, dialog); tidak ada rute edit
    if (parts[1] === "new") return "billing.create";
    return null;
  }
  return null;
}

export function routeToResource(pathname: string): ResourceKey | null {
  const seg =
    pathname.split("/").filter(Boolean)[1] ??
    pathname.split("/").filter(Boolean)[0];
  switch (seg) {
    case "customers":
    case "customer":
      return "customer";
    case "billing":
      return "billing";
    case "sessions":
    case "session":
      return "session";
    case "profiles":
    case "profile":
      return "profile";
    case "routers":
    case "router":
      return "router";
    case "users":
    case "user":
      return "user";
    case "logs":
      return "session";
    default:
      return null;
  }
}

/** Role bawaan (tidak tersimpan di localStorage) */
export const BUILT_IN_ROLES: Record<string, Role> = {
  "role-admin": {
    id: "role-admin",
    name: "Administrator",
    description:
      "Akses penuh ke seluruh sistem, termasuk pengelolaan pengguna, role, dan pengaturan lanjutan.",
    permissions: [],
    system: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  "role-manager": {
    id: "role-manager",
    name: "Manager",
    description:
      "Mengelola operasional harian, laporan keuangan, serta pengawasan data pelanggan dan layanan dengan batasan izin lanjutan yang diatur oleh administrator.",
    permissions: [
      "customer.read",
      "customer.create",
      "customer.update",
      "billing.read",
      "billing.create",
      "billing.update",
      "session.read",
      "profile.read",
      "router.read",
      "log.read",
      "setting.read",
    ],
    system: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  "role-customer": {
    id: "role-customer",
    name: "Pelanggan",
    description:
      "Hanya dapat mengakses portal pelanggan (informasi, pemakaian, tagihan, pembayaran, dan log pribadi).",
    permissions: [],
    system: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
};

export function getUserRoleById(roleId?: string): Role | undefined {
  if (!roleId) return undefined;
  const custom = readCustomRoles().find((r) => r.id === roleId);
  if (custom) return custom;
  return BUILT_IN_ROLES[roleId];
}

/** Role kustom dari localStorage (dibuat lewat menu Pengaturan Role) — dibaca
 *  setiap kali agar role baru langsung berlaku tanpa reload. */
export function readCustomRoles(): Role[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("microrad_roles");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Role[];
    return parsed
      .filter((r) => !r.system)
      .map((r) => ({ ...r, permissions: [...r.permissions] }));
  } catch {
    return [];
  }
}

/**
 * Cek permission. Administrator (role_bawaan role-admin) selalu punya akses
 * penuh; role lain harus memiliki permission tersebut secara eksplisit.
 */
export function hasPermission(
  user: AppUser | null,
  permission: Permission,
): boolean {
  if (!user) return false;
  const role = getUserRoleById(user.roleId);
  if (!role) return false;
  if (role.id === "role-admin") return true;
  return role.permissions.includes(permission);
}

/** Hanya administrator yang boleh mengelola role & pengaturan sistem */
export function canManageRoles(user: AppUser | null): boolean {
  return getUserRoleById(user?.roleId)?.id === "role-admin";
}

export function canAccessUsersPage(user: AppUser | null): boolean {
  return hasPermission(user, "user.read");
}
