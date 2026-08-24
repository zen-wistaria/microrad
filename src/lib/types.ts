// Data Models strictly aligned with FreeRADIUS schema & PRD Section 7

export type CustomerStatus = "active" | "suspended" | "disabled";

export type RateUnit = "Kbps" | "Mbps";
export type IpModuleType = "sql" | "mikrotik_pool";

export interface Bandwidth {
  id: string;
  name: string;
  minUpload?: number | null;
  minUploadUnit: RateUnit;
  minDownload?: number | null;
  minDownloadUnit: RateUnit;
  maxUpload: number;
  maxUploadUnit: RateUnit;
  maxDownload: number;
  maxDownloadUnit: RateUnit;

  burstLimitUpload?: number | null;
  burstLimitUploadUnit?: RateUnit | null;
  burstLimitDownload?: number | null;
  burstLimitDownloadUnit?: RateUnit | null;
  burstThresholdUpload?: number | null;
  burstThresholdUploadUnit?: RateUnit | null;
  burstThresholdDownload?: number | null;
  burstThresholdDownloadUnit?: RateUnit | null;
  burstTime?: number | null; // detik

  createdAt: string;
  updatedAt: string;
  pppProfileCount?: number; // derived
}

export interface PppProfile {
  id: string;
  name: string;
  nasId: string;
  nasRouter?: {
    id: string;
    name: string;
    ipAddress: string;
  };
  type: string; // "PPP"
  ipModule: IpModuleType;
  localAddress: string; // IP Gateway (e.g. 10.10.10.1)
  rangeIpStart: string; // e.g. 10.10.10.2
  rangeIpEnd: string; // e.g. 10.10.10.254
  dnsServers: string; // default "8.8.8.8,8.8.4.4"
  parentQueue?: string | null;
  profileGroupId?: string | null;
  profileGroup?: {
    id: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileGroup {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  pppProfiles?: PppProfile[];
  pppProfileCount?: number; // derived
  customerCount?: number; // derived
}

export interface InternetProfile {
  id: string;
  name: string;
  price: number; // IDR / bulan
  bandwidthId: string;
  bandwidth?: Bandwidth;
  priority: number; // 1-8 (default 8)
  createdAt: string;
  updatedAt: string;
  customerCount?: number; // derived
}

// Backward compatibility alias for parts expecting BandwidthProfile
export type BandwidthProfile = InternetProfile;

export interface Customer {
  id: string;
  username: string; // radcheck.username (login PPPoE)
  password?: string; // radcheck password (virtual / transient for update)
  fullName?: string; // metadata tambahan
  email?: string; // akun login portal pelanggan
  phone?: string;
  address?: string;
  status: CustomerStatus;
  profileId: string; // relasi ke InternetProfile (Paket Internet)
  profile?: InternetProfile | null;
  profileGroupId?: string; // relasi ke ProfileGroup (Wilayah / Failover Group)
  profileGroup?: ProfileGroup | null;
  staticIp?: string; // radreply: Framed-IP-Address
  nasId?: string; // NAS router ID (terakhir/default)
  nasRouter?: {
    id: string;
    name: string;
    ipAddress: string;
  } | null;
  bindOnNas?: boolean; // hanya boleh login lewat router di wilayahnya (radnasallow)
  sessionMode?: "single" | "multi"; // mode sesi PPPoE
  maxSimultaneous?: number; // maksimal sesi simultan jika multi (Simultaneous-Use)
  allowedNasIps?: string[]; // whitelist IP router NAS
  createdAt: string;
  updatedAt: string;
  isOnline?: boolean;
  lastSeenAt?: string; // dari radacct terakhir
  portalUser?: {
    id: string;
    name?: string;
    username?: string | null;
    email?: string | null;
    createdAt?: string;
  } | null;
  portalPassword?: string;
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

export type NasRouterStatus =
  | "online"
  | "online_ping_only"
  | "online_api_only"
  | "offline"
  | "unknown";

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
