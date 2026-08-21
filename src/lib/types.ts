// Data Models strictly aligned with FreeRADIUS schema & PRD Section 7

export type CustomerStatus = "active" | "suspended" | "disabled";

export interface Customer {
  id: string;
  username: string; // radcheck.username (login PPPoE)
  password?: string; // radcheck password (virtual / transient for update)
  fullName?: string; // metadata tambahan
  email?: string; // akun login portal pelanggan
  phone?: string;
  address?: string;
  status: CustomerStatus;
  profileId: string; // relasi ke BandwidthProfile (Mikrotik-Rate-Limit)
  staticIp?: string; // radreply: Framed-IP-Address
  nasId?: string; // NAS default/terakhir dipakai
  bindOnNas?: boolean; // hanya boleh login lewat router nasId (radcheck NAS-IP-Address)
  createdAt: string;
  updatedAt: string;
  isOnline?: boolean;
  lastSeenAt?: string; // dari radacct terakhir
  portalUser?: {
    id: string;
    name?: string;
    email: string;
    createdAt?: string;
  } | null;
  portalPassword?: string;
}

export interface BandwidthProfile {
  id: string;
  name: string; // mis. "Paket 10Mbps - Home"
  rateLimitDown: number; // dalam Mbps
  rateLimitUp: number; // dalam Mbps
  price?: number; // harga bulanan dalam Rupiah (IDR)
  description?: string;
  // ── QoS lanjutan ala MikroTik (opsional; kbps) ──
  burstLimitDown?: number | null; // burst-limit rx (kbps)
  burstLimitUp?: number | null; // burst-limit tx (kbps)
  burstThresholdDown?: number | null; // burst-threshold rx (kbps)
  burstThresholdUp?: number | null; // burst-threshold tx (kbps)
  burstTimeSeconds?: number | null; // burst-time (detik)
  priority?: number | null; // 1-8, 1 tertinggi
  limitAtDown?: number | null; // limit-at rx / CIR (kbps)
  limitAtUp?: number | null; // limit-at tx / CIR (kbps)
  customerCount: number; // derived jumlah customer yang memakai profile ini
}

export type InvoiceStatus = "paid" | "unpaid" | "overdue" | "cancelled";

export type PaymentMethod =
  | "qris"
  | "transfer_bca"
  | "transfer_mandiri"
  | "transfer_bri"
  | "cash"
  | "other";

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. "INV-202608-001"
  customerId: string;
  customerUsername: string;
  customerFullName?: string;
  customerPhone?: string;
  customerAddress?: string;
  profileId: string;
  profileName: string;
  periodMonth: number; // 1 - 12
  periodYear: number; // 2026
  subtotal: number; // in IDR
  tax: number; // PPN
  discount: number;
  adminFee: number;
  /** Termasuk dalam tagihan bulanan (satuan Rupiah), default 0 */
  installationFee: number;
  /** Persentase PPN (0-100) yang dikenakan atas subtotal */
  taxPercent: number;
  totalAmount: number;
  status: InvoiceStatus;
  issueDate: string; // ISO date
  dueDate: string; // ISO date
  paidAt?: string;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  paidAt: string;
  receivedBy: string;
  notes?: string;
}

export interface BillingSummary {
  totalRevenueThisMonth: number;
  totalPendingAmount: number;
  totalOverdueAmount: number;
  paidCount: number;
  unpaidCount: number;
  overdueCount: number;
  totalInvoicesCount: number;
}

export type NasRouterStatus = "online" | "offline" | "unknown";

export interface NasRouter {
  id: string;
  name: string; // shortname / nama router
  ipAddress: string; // nasname / IP Router MikroTik
  location?: string;
  type: "mikrotik";
  status: NasRouterStatus;
  activeSessionCount: number; // derived jumlah sesi aktif di router ini
  // ── Koneksi API RouterOS & RADIUS (backend /api/v1/routers) ──
  apiUsername?: string;
  apiPasswordSet?: boolean; // true = API password tersimpan di DB
  apiPort?: number; // default 8728
  radiusSecret?: string;
  radiusEnabled?: boolean; // router sudah dihubungkan ke FreeRADIUS
  syncEnabled?: boolean; // poller membaca /ppp/active dari router ini
  lastSeenAt?: string; // terakhir kali API merespons (ping/sync)
  lastSyncedAt?: string; // terakhir kali poller sinkronisasi selesai
}

export interface Session {
  id: string;
  customerId: string | null; // null = sesi PPPoE tak dikenal (dari RouterOS)
  customerUsername: string;
  nasId: string;
  nasIpAddress: string;
  framedIp?: string;
  startedAt: string;
  stoppedAt?: string; // null/undefined = masih online
  durationSeconds: number; // live-update jika online
  inputBytes: number; // AcctInputOctets (upload dari sisi customer)
  outputBytes: number; // AcctOutputOctets (download dari sisi customer)
  extKey?: string; // session-id asli RouterOS (sinkronisasi poller)
  terminateCause?: string; // "User-Request" | "Lost-Carrier" | "Admin-Reset" dsb
  /** Waktu basis durasi server (Interim radacct) — untuk counter live */
  acctUpdateTime?: string;
}

// Konfigurasi identitas perusahaan (dipakai di header invoice / nota cetak)
export interface CompanyProfile {
  brandName: string; // nama brand, mis. "MicroRAD Internet Services"
  fullName: string; // nama legal perusahaan, mis. "PT MicroRAD Broadband Solusindo"
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  npwp?: string;
  licenseNo?: string; // izin ISP Kominfo
  updatedAt?: string;
}

export type AppUserRole = "admin" | "operator";
export type AppUserStatus = "active" | "disabled";

// RBAC: permission (baca / buat / ubah / hapus) per modul
export type Permission =
  | "customer.read"
  | "customer.create"
  | "customer.update"
  | "customer.delete"
  | "billing.read"
  | "billing.create"
  | "billing.update"
  | "billing.delete"
  | "session.read"
  | "session.create"
  | "session.update"
  | "session.delete"
  | "profile.read"
  | "profile.create"
  | "profile.update"
  | "profile.delete"
  | "router.read"
  | "router.create"
  | "router.update"
  | "router.delete"
  | "user.read"
  | "user.create"
  | "user.update"
  | "user.delete"
  | "log.read"
  | "setting.read"
  | "setting.update";

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  /** Role bawaan sistem (Admin, Manager, Pelanggan) tidak dapat dihapus */
  system: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppUser {
  id: string;
  name: string;
  username?: string | null;
  email: string;
  password?: string;
  role: AppUserRole;
  roleId?: string; // relasi RBAC ke Role (id role_bawaan/role kustom)
  status: AppUserStatus;
  createdAt: string;
  lastLoginAt?: string;
  /** Legacy: akun portal pelanggan kini terpisah (PortalUser) — hanya di mock seed */
  customerId?: string;
}

export interface CustomerPortalSummary {
  totalUsage30dBytes: number;
  totalDownload30dBytes: number;
  totalUpload30dBytes: number;
  onlineSessionCount: number;
  onlineNow: boolean;
  totalPaidAmount: number;
  totalOutstandingAmount: number;
  activeInvoiceCount: number;
}

export interface UsageTrendPoint {
  date: string;
  downloadBytes: number;
  uploadBytes: number;
  bytes: number; // total = download + upload
}

export interface DashboardStats {
  totalCustomers: number;
  activeCustomers: number;
  suspendedCustomers: number;
  onlineNow: number;
  totalRoutersOnline: number;
  totalRoutersOffline: number;
  totalTrafficTodayBytes: number;
  totalDownloadTodayBytes: number;
  totalUploadTodayBytes: number;
  usageTrend: UsageTrendPoint[];
}

export interface CustomerDailyUsage {
  date: string;
  downloadBytes: number;
  uploadBytes: number;
  totalBytes: number;
  sessionsCount: number;
}

export interface CustomerMonthlyUsage {
  /** Format "YYYY-MM" */
  month: string;
  label: string; // mis. "Jul 2026"
  downloadBytes: number;
  uploadBytes: number;
  totalBytes: number;
  sessionsCount: number;
}

// ── Tipe utusan dari data mock (dipakai runtime frontend) ──────────
// GlobalLog: catatan login sistem/portal (ditulis API → tabel global_log).
export interface GlobalLogEntry {
  id: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  /** Nama user yang login (bukan username) */
  userName: string;
  /** Sumber login: "portal" | "app" | "api" */
  source: "portal" | "app" | "api";
}

// PortalLoginLog: histori login portal pelanggan.
export interface LogLoginPortal {
  id: string;
  customerId: string;
  customerUsername: string;
  loginAt: string;
  ipAddress: string;
  userAgent: string;
  source?: string;
}

// PortalSessionLog: histori sesi PPPoE pelanggan (dari radacct).
export interface LogSesiPppoe {
  id: string;
  customerId: string;
  customerUsername: string;
  startedAt: string;
  stoppedAt?: string; // undefined = masih online
  durationSeconds: number;
  inputBytes: number; // upload dari sisi customer
  outputBytes: number; // download dari sisi customer
  nasIpAddress: string;
  framedIp?: string;
  terminateCause?: string;
}
