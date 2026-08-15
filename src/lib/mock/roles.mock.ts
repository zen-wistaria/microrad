import type { Permission, Role } from "../types";

export const ALL_PERMISSIONS: Permission[] = [
  "customer.read",
  "customer.create",
  "customer.update",
  "customer.delete",
  "billing.read",
  "billing.create",
  "billing.update",
  "billing.delete",
  "session.read",
  "session.create",
  "session.update",
  "session.delete",
  "profile.read",
  "profile.create",
  "profile.update",
  "profile.delete",
  "router.read",
  "router.create",
  "router.update",
  "router.delete",
  "user.read",
  "user.create",
  "user.update",
  "user.delete",
  "log.read",
  "setting.read",
  "setting.update",
];

// Role bawaan sistem — tidak dapat dihapus.
// Administrator: akses penuh (semua permission otomatis, lihat userHasPermission).
export const initialRoles: Role[] = [
  {
    id: "role-admin",
    name: "Administrator",
    description:
      "Akses penuh ke seluruh sistem, termasuk pengelolaan pengguna, role, dan pengaturan lanjutan.",
    permissions: [...ALL_PERMISSIONS],
    system: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
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
  {
    id: "role-customer",
    name: "Pelanggan",
    description:
      "Hanya dapat mengakses portal pelanggan (informasi, pemakaian, tagihan, pembayaran, dan log pribadi).",
    permissions: [],
    system: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];
