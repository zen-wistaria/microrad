// Data Models strictly aligned with FreeRADIUS schema & PRD Section 7

export type CustomerStatus = "active" | "suspended" | "disabled";

export interface Customer {
  id: string;
  username: string; // radcheck.username (login PPPoE)
  password?: string; // radcheck password (virtual / transient for update)
  fullName?: string; // metadata tambahan
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
  description?: string;
  customerCount: number; // derived jumlah customer yang memakai profile ini
}

export interface NasRouter {
  id: string;
  name: string; // shortname / nama router
  ipAddress: string; // nasname / IP Router MikroTik
  location?: string;
  type: "mikrotik";
  status: "online" | "offline" | "unknown";
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

export type AppUserRole = "admin" | "operator";
export type AppUserStatus = "active" | "disabled";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: AppUserRole;
  status: AppUserStatus;
  createdAt: string;
  lastLoginAt?: string;
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
