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
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string; // dari radacct terakhir
  currentSessionId?: string; // jika sedang online, id sesi aktif
}

export interface BandwidthProfile {
  id: string;
  name: string; // mis. "Paket 10Mbps - Home"
  rateLimitDown: number; // dalam Mbps
  rateLimitUp: number; // dalam Mbps
  price?: number; // harga bulanan dalam Rupiah (IDR)
  description?: string;
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
}

export interface Session {
  id: string;
  customerId: string;
  customerUsername: string;
  nasId: string;
  nasIpAddress: string;
  framedIp?: string;
  startedAt: string;
  stoppedAt?: string; // null/undefined = masih online
  durationSeconds: number; // live-update jika online
  inputBytes: number; // AcctInputOctets (upload dari sisi customer)
  outputBytes: number; // AcctOutputOctets (download dari sisi customer)
  terminateCause?: string; // "User-Request" | "Lost-Carrier" | "Admin-Reset" dsb
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

export type AppUserRole = "admin" | "operator" | "customer";
export type AppUserStatus = "active" | "disabled";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: AppUserRole;
  status: AppUserStatus;
  createdAt: string;
  lastLoginAt?: string;
  /** Jika role = "customer", merujuk ke id Customer di tabel pelanggan */
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
