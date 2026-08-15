import type {
  AppUser,
  AppUserRole,
  BandwidthProfile,
  CompanyProfile,
  Customer,
  CustomerDailyUsage,
  CustomerMonthlyUsage,
  DashboardStats,
  NasRouter,
  Permission,
  Role,
  Session,
  UsageTrendPoint,
} from "../types";
import { initialCustomers } from "./customers.mock";
import {
  getGlobalLogs as buildGlobalLogs,
  type GlobalLogEntry,
} from "./global-logs";
import { initialProfiles } from "./profiles.mock";
import { relMonthsAgo, relNow } from "./relative-dates";
import { initialRoles } from "./roles.mock";
import { initialRouters } from "./routers.mock";
import { initialSessions } from "./sessions.mock";
import { initialCompanyProfile } from "./settings.mock";
import { initialUsers } from "./users.mock";

const STORAGE_KEYS = {
  ROLES: "microrad_roles",
  CUSTOMERS: "microrad_customers",
  PROFILES: "microrad_profiles",
  ROUTERS: "microrad_routers",
  SESSIONS: "microrad_sessions",
  USERS: "microrad_users",
  COMPANY_PROFILE: "microrad_company_profile",
  INITIALIZED: "microrad_initialized_v2",
};

/**
 * Data mock pelanggan menyimpan tanggal relatif sebagai string literal
 * (mis. "relMonthsAgoIso(7, 8, 30)") agar selalu mengikuti hari berjalan.
 * String ini hanya valid di file source, bukan di JSON runtime — resolve
 * ke Date asli pada saat data dimuat, sehingga createdAt bisa dipakai
 * logika bisnis (mis. perhitungan tenggat jatuh tempo).
 */
function resolveMockDates<T>(rows: T[]): T[] {
  return rows.map((row) => {
    if (!row || typeof row !== "object") return row;
    const out: Record<string, unknown> = {
      ...(row as Record<string, unknown>),
    };
    for (const [key, value] of Object.entries(out)) {
      if (typeof value !== "string") continue;
      const match = value.match(
        /^relMonthsAgoIso\(([\d.]+),\s*(\d+),\s*(\d+)\)$/,
      );
      if (match) {
        out[key] = relMonthsAgo(
          Number(match[1]),
          Number(match[2]),
          Number(match[3]),
        ).toISOString();
        continue;
      }
      const matchNow = value.match(
        /^relNowIso\((\d+),\s*(\d+)(?:,\s*(\d+))?\)$/,
      );
      if (matchNow) {
        out[key] = relNow(
          Number(matchNow[1]),
          Number(matchNow[2]),
          Number(matchNow[3] ?? 0),
        ).toISOString();
      }
    }
    return out as T;
  });
}

class MockDatabase {
  private customers: Customer[] = [];
  private profiles: BandwidthProfile[] = [];
  private routers: NasRouter[] = [];
  private sessions: Session[] = [];
  private users: AppUser[] = [];
  private companyProfile: CompanyProfile = { ...initialCompanyProfile };
  private isLoaded = false;

  constructor() {
    this.load();
  }

  private isBrowser(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined"
    );
  }

  private load(): void {
    if (this.isLoaded) return;
    if (!this.isBrowser()) {
      // Server-side default
      this.customers = resolveMockDates(initialCustomers);
      this.profiles = [...initialProfiles];
      this.routers = [...initialRouters];
      this.sessions = [...initialSessions];
      this.users = [...initialUsers];
      this.roles = [...initialRoles];
      this.companyProfile = { ...initialCompanyProfile };
      this.isLoaded = true;
      return;
    }

    try {
      const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
      if (!initialized) {
        this.resetToDefaults();
      } else {
        const storedCustomers = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
        const storedProfiles = localStorage.getItem(STORAGE_KEYS.PROFILES);
        const storedRouters = localStorage.getItem(STORAGE_KEYS.ROUTERS);
        const storedSessions = localStorage.getItem(STORAGE_KEYS.SESSIONS);
        const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
        const storedRoles = localStorage.getItem(STORAGE_KEYS.ROLES);

        this.customers = storedCustomers
          ? resolveMockDates(JSON.parse(storedCustomers))
          : resolveMockDates(initialCustomers);
        this.profiles = storedProfiles
          ? JSON.parse(storedProfiles)
          : [...initialProfiles];
        this.routers = storedRouters
          ? JSON.parse(storedRouters)
          : [...initialRouters];
        this.sessions = storedSessions
          ? JSON.parse(storedSessions)
          : [...initialSessions];
        this.users = storedUsers ? JSON.parse(storedUsers) : [...initialUsers];
        this.roles = storedRoles ? JSON.parse(storedRoles) : [...initialRoles];
        const storedProfile = localStorage.getItem(
          STORAGE_KEYS.COMPANY_PROFILE,
        );
        this.companyProfile = storedProfile
          ? JSON.parse(storedProfile)
          : { ...initialCompanyProfile };
      }
    } catch {
      this.resetToDefaults();
    }
    this.recalculateDerivedCounts();
    this.isLoaded = true;
  }

  private save(): void {
    if (!this.isBrowser()) return;
    try {
      this.recalculateDerivedCounts();
      localStorage.setItem(
        STORAGE_KEYS.CUSTOMERS,
        JSON.stringify(this.customers),
      );
      localStorage.setItem(
        STORAGE_KEYS.PROFILES,
        JSON.stringify(this.profiles),
      );
      localStorage.setItem(STORAGE_KEYS.ROUTERS, JSON.stringify(this.routers));
      localStorage.setItem(
        STORAGE_KEYS.SESSIONS,
        JSON.stringify(this.sessions),
      );
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(this.users));
      localStorage.setItem(STORAGE_KEYS.ROLES, JSON.stringify(this.roles));
      localStorage.setItem(
        STORAGE_KEYS.COMPANY_PROFILE,
        JSON.stringify(this.companyProfile),
      );
    } catch (e) {
      console.error("Failed to save state to localStorage", e);
    }
  }

  public resetToDefaults(): void {
    this.customers = resolveMockDates(
      JSON.parse(JSON.stringify(initialCustomers)),
    );
    this.profiles = JSON.parse(JSON.stringify(initialProfiles));
    this.routers = JSON.parse(JSON.stringify(initialRouters));
    this.sessions = JSON.parse(JSON.stringify(initialSessions));
    this.users = JSON.parse(JSON.stringify(initialUsers));
    this.companyProfile = JSON.parse(JSON.stringify(initialCompanyProfile));
    this.recalculateDerivedCounts();

    if (this.isBrowser()) {
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, "true");
      this.save();
    }
  }

  private recalculateDerivedCounts(): void {
    // 1. Profile customerCount
    const profileCounts: Record<string, number> = {};
    for (const c of this.customers) {
      if (c.profileId) {
        profileCounts[c.profileId] = (profileCounts[c.profileId] || 0) + 1;
      }
    }
    this.profiles = this.profiles.map((p) => ({
      ...p,
      customerCount: profileCounts[p.id] || 0,
    }));

    // 2. Active sessions per router
    const routerSessions: Record<string, number> = {};
    for (const s of this.sessions) {
      if (!s.stoppedAt) {
        routerSessions[s.nasId] = (routerSessions[s.nasId] || 0) + 1;
      }
    }
    this.routers = this.routers.map((r) => ({
      ...r,
      activeSessionCount: routerSessions[r.id] || 0,
    }));
  }

  // --- Customers CRUD ---
  public getCustomers(filters?: {
    search?: string;
    status?: string;
    profileId?: string;
  }): Customer[] {
    this.load();
    let result = [...this.customers];

    if (filters?.search) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.username.toLowerCase().includes(q) ||
          c.fullName?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.staticIp?.includes(q),
      );
    }

    if (filters?.status && filters.status !== "all") {
      result = result.filter((c) => c.status === filters.status);
    }

    if (filters?.profileId && filters.profileId !== "all") {
      result = result.filter((c) => c.profileId === filters.profileId);
    }

    return result;
  }

  public getCustomerById(id: string): Customer | undefined {
    this.load();
    return this.customers.find((c) => c.id === id);
  }

  public getCustomerByUsername(username: string): Customer | undefined {
    this.load();
    return this.customers.find(
      (c) => c.username.toLowerCase() === username.toLowerCase(),
    );
  }

  public createCustomer(
    data: Omit<Customer, "id" | "createdAt" | "updatedAt">,
  ): Customer {
    this.load();
    const id = `cust-${Date.now()}`;
    const newCustomer: Customer = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.customers.unshift(newCustomer);
    this.save();
    return newCustomer;
  }

  public updateCustomer(
    id: string,
    updates: Partial<Customer>,
  ): Customer | undefined {
    this.load();
    const index = this.customers.findIndex((c) => c.id === id);
    if (index === -1) return undefined;

    this.customers[index] = {
      ...this.customers[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.customers[index];
  }

  public deleteCustomer(id: string): boolean {
    this.load();
    const customer = this.customers.find((c) => c.id === id);
    if (!customer) return false;

    // Disconnect active session if any
    if (customer.currentSessionId) {
      this.disconnectSession(customer.currentSessionId, "Admin-Reset");
    }

    this.customers = this.customers.filter((c) => c.id !== id);
    this.save();
    return true;
  }

  // --- Profiles CRUD ---
  public getProfiles(): BandwidthProfile[] {
    this.load();
    this.recalculateDerivedCounts();
    return [...this.profiles];
  }

  public getProfileById(id: string): BandwidthProfile | undefined {
    this.load();
    return this.profiles.find((p) => p.id === id);
  }

  public createProfile(
    data: Omit<BandwidthProfile, "id" | "customerCount">,
  ): BandwidthProfile {
    this.load();
    const id = `prof-${Date.now()}`;
    const newProfile: BandwidthProfile = {
      ...data,
      id,
      customerCount: 0,
    };
    this.profiles.push(newProfile);
    this.save();
    return newProfile;
  }

  public updateProfile(
    id: string,
    updates: Partial<BandwidthProfile>,
  ): BandwidthProfile | undefined {
    this.load();
    const index = this.profiles.findIndex((p) => p.id === id);
    if (index === -1) return undefined;

    this.profiles[index] = {
      ...this.profiles[index],
      ...updates,
    };
    this.save();
    return this.profiles[index];
  }

  public deleteProfile(id: string): { success: boolean; error?: string } {
    this.load();
    const profile = this.profiles.find((p) => p.id === id);
    if (!profile) return { success: false, error: "Profil tidak ditemukan" };

    const attachedCount = this.customers.filter(
      (c) => c.profileId === id,
    ).length;
    if (attachedCount > 0) {
      return {
        success: false,
        error: `Profil tidak dapat dihapus karena masih digunakan oleh ${attachedCount} pelanggan. Silakan pindahkan pelanggan terlebih dahulu.`,
      };
    }

    this.profiles = this.profiles.filter((p) => p.id !== id);
    this.save();
    return { success: true };
  }

  // --- Routers CRUD ---
  public getRouters(): NasRouter[] {
    this.load();
    this.recalculateDerivedCounts();
    return [...this.routers];
  }

  public getRouterById(id: string): NasRouter | undefined {
    this.load();
    return this.routers.find((r) => r.id === id);
  }

  public createRouter(
    data: Omit<NasRouter, "id" | "activeSessionCount">,
  ): NasRouter {
    this.load();
    const id = `nas-${Date.now()}`;
    const newRouter: NasRouter = {
      ...data,
      id,
      activeSessionCount: 0,
    };
    this.routers.push(newRouter);
    this.save();
    return newRouter;
  }

  public updateRouter(
    id: string,
    updates: Partial<NasRouter>,
  ): NasRouter | undefined {
    this.load();
    const index = this.routers.findIndex((r) => r.id === id);
    if (index === -1) return undefined;

    this.routers[index] = {
      ...this.routers[index],
      ...updates,
    };
    this.save();
    return this.routers[index];
  }

  public deleteRouter(id: string): { success: boolean; error?: string } {
    this.load();
    const router = this.routers.find((r) => r.id === id);
    if (!router) return { success: false, error: "Router tidak ditemukan" };

    // Check if active sessions exist on this router
    const activeSessions = this.sessions.filter(
      (s) => s.nasId === id && !s.stoppedAt,
    );
    if (activeSessions.length > 0) {
      return {
        success: false,
        error: `Router tidak dapat dihapus karena masih memiliki ${activeSessions.length} sesi aktif. Putuskan koneksi terlebih dahulu.`,
      };
    }

    this.routers = this.routers.filter((r) => r.id !== id);
    this.save();
    return { success: true };
  }

  // --- Sessions Management ---
  public getSessions(options?: {
    activeOnly?: boolean;
    customerId?: string;
    nasId?: string;
    search?: string;
  }): Session[] {
    this.load();
    let list = [...this.sessions];

    if (options?.activeOnly) {
      list = list.filter((s) => !s.stoppedAt);
    }

    if (options?.customerId) {
      list = list.filter((s) => s.customerId === options.customerId);
    }

    if (options?.nasId && options.nasId !== "all") {
      list = list.filter((s) => s.nasId === options.nasId);
    }

    if (options?.search) {
      const q = options.search.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.customerUsername.toLowerCase().includes(q) ||
          s.framedIp?.includes(q) ||
          s.nasIpAddress.includes(q),
      );
    }

    // Sesi aktif "hidup": durasi & trafik diperpanjang sesuai waktu berjalan
    // (tanpa menyimpan ke storage — murni tampilan).
    const nowMs = Date.now();
    list = list.map((s) => {
      if (s.stoppedAt) return s;
      const started = new Date(s.startedAt).getTime();
      const elapsed = Math.max(0, (nowMs - started) / 1000);
      const growth = 1 + Math.min(elapsed * 10, 60 * 60) / (60 * 60); // 1× → 2×
      return {
        ...s,
        durationSeconds: Math.round(elapsed),
        inputBytes: Math.round(s.inputBytes * growth),
        outputBytes: Math.round(s.outputBytes * growth),
      };
    });

    // Sort by startedAt descending
    return list.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }

  public getActiveSessionForCustomer(customerId: string): Session | undefined {
    this.load();
    const session = this.sessions.find(
      (s) => s.customerId === customerId && !s.stoppedAt,
    );
    if (!session) return undefined;

    // Sesi aktif "hidup": durasi & trafik diperpanjang sesuai waktu berjalan
    // (tanpa menyimpan ke storage — murni tampilan).
    const nowMs = Date.now();
    const started = new Date(session.startedAt).getTime();
    const elapsed = Math.max(0, (nowMs - started) / 1000);
    const growth = 1 + Math.min(elapsed * 10, 60 * 60) / (60 * 60); // 1× → 2×
    return {
      ...session,
      durationSeconds: Math.round(elapsed),
      inputBytes: Math.round(session.inputBytes * growth),
      outputBytes: Math.round(session.outputBytes * growth),
    };
  }

  /** Perkiraan trafik sesi aktif saat ini (murni tampilan, tidak disimpan). */
  private liveBytesNow(s: Session, nowMs: number): number {
    const started = new Date(s.startedAt).getTime();
    const elapsed = Math.max(0, (nowMs - started) / 1000);
    const growth = 1 + Math.min(elapsed * 10, 60 * 60) / (60 * 60); // 1× → 2×
    return Math.round(s.outputBytes * growth);
  }

  public disconnectSession(sessionId: string, cause = "User-Request"): boolean {
    this.load();
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session || session.stoppedAt) return false;

    const stopTime = new Date();
    const duration = Math.max(
      1,
      Math.floor(
        (stopTime.getTime() - new Date(session.startedAt).getTime()) / 1000,
      ),
    );

    session.stoppedAt = stopTime.toISOString();
    session.durationSeconds = duration;
    session.terminateCause = cause;

    // Clear currentSessionId on customer
    const customer = this.customers.find((c) => c.id === session.customerId);
    if (customer) {
      customer.currentSessionId = undefined;
      customer.lastSeenAt = stopTime.toISOString();
    }

    this.save();
    return true;
  }

  public disconnectCustomer(customerId: string): boolean {
    this.load();
    const activeSession = this.getActiveSessionForCustomer(customerId);
    if (activeSession) {
      return this.disconnectSession(activeSession.id, "Admin-Reset");
    }
    return false;
  }

  // --- Roles RBAC ---
  private roles: Role[] = [];

  public getRoles(): Role[] {
    this.load();
    return [...this.roles].sort((a, b) => {
      const aSeeded = a.system ? 0 : 1;
      const bSeeded = b.system ? 0 : 1;
      return aSeeded - bSeeded || a.name.localeCompare(b.name);
    });
  }

  public getRoleById(id: string): Role | undefined {
    this.load();
    return this.roles.find((r) => r.id === id);
  }

  public createRole(data: {
    name: string;
    description?: string;
    permissions: Permission[];
  }): Role {
    this.load();
    const id = `role-${Date.now()}`;
    const newRole: Role = {
      id,
      name: data.name,
      description: data.description,
      permissions: [...data.permissions],
      system: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.roles.push(newRole);
    this.save();
    return newRole;
  }

  public updateRole(
    id: string,
    updates: {
      name?: string;
      description?: string;
      permissions?: Permission[];
    },
  ): Role | undefined {
    this.load();
    const index = this.roles.findIndex((r) => r.id === id);
    if (index === -1) return undefined;

    this.roles[index] = {
      ...this.roles[index],
      ...updates,
      ...(updates.permissions ? { permissions: [...updates.permissions] } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return this.roles[index];
  }

  public deleteRole(id: string): { success: boolean; error?: string } {
    this.load();
    const role = this.roles.find((r) => r.id === id);
    if (!role) return { success: false, error: "Role tidak ditemukan" };
    if (role.system) {
      return {
        success: false,
        error:
          "Role bawaan sistem (Admin, Manager, Pelanggan) tidak dapat dihapus.",
      };
    }
    const usedCount = this.users.filter((u) => u.roleId === id).length;
    if (usedCount > 0) {
      return {
        success: false,
        error: `Role ini masih digunakan oleh ${usedCount} pengguna. Pindahkan atau hapus pengguna tersebut terlebih dahulu.`,
      };
    }
    this.roles = this.roles.filter((r) => r.id !== id);
    this.save();
    return { success: true };
  }

  getUserRole(user: AppUser | null): Role | undefined {
    if (!user) return undefined;
    if (user.roleId) {
      const byId = this.roles.find((r) => r.id === user.roleId);
      if (byId) return byId;
    }
    // Fallback legacy: role lama (admin/operator/customer) → role bawaan
    const legacy: Record<AppUserRole, string> = {
      admin: "role-admin",
      operator: "role-manager",
      customer: "role-customer",
    };
    return this.roles.find((r) => r.id === legacy[user.role]);
  }

  public userHasPermission(
    user: AppUser | null,
    permission: Permission,
  ): boolean {
    if (!user) return false;
    const role = this.getUserRole(user);
    if (!role) return false;
    // Role bawaan Administrator selalu punya akses penuh (semua permission)
    if (role.id === "role-admin") return true;
    if (role.permissions.includes(permission)) return true;
    return false;
  }

  // --- App Users CRUD ---
  public getCompanyProfile(): CompanyProfile {
    this.load();
    return { ...this.companyProfile };
  }

  public updateCompanyProfile(
    updates: Partial<CompanyProfile>,
  ): CompanyProfile {
    this.load();
    this.companyProfile = {
      ...this.companyProfile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.save();
    return { ...this.companyProfile };
  }

  public getUsers(): AppUser[] {
    this.load();
    return [...this.users];
  }

  /** Log login global semua pengguna — dengan filter pencarian/sumber/rentang waktu */
  public getGlobalLogs(filter?: {
    search?: string;
    source?: string;
    from?: string;
    to?: string;
  }): GlobalLogEntry[] {
    this.load();
    let logs = buildGlobalLogs(this.users);

    if (filter?.search) {
      const q = filter.search.toLowerCase().trim();
      logs = logs.filter(
        (l) =>
          l.userName.toLowerCase().includes(q) ||
          l.ipAddress.includes(q) ||
          l.userAgent.toLowerCase().includes(q),
      );
    }

    if (filter?.source && filter.source !== "all") {
      logs = logs.filter((l) => l.source === filter.source);
    }

    if (filter?.from) {
      const fromMs = new Date(filter.from).getTime();
      if (!Number.isNaN(fromMs)) {
        logs = logs.filter((l) => new Date(l.timestamp).getTime() >= fromMs);
      }
    }

    if (filter?.to) {
      // Sertakan seluruh hari "to" (00:00–23:59)
      const toEnd = new Date(filter.to);
      toEnd.setHours(23, 59, 59, 999);
      const toMs = toEnd.getTime();
      if (!Number.isNaN(toMs)) {
        logs = logs.filter((l) => new Date(l.timestamp).getTime() <= toMs);
      }
    }

    return logs;
  }

  /** Resolve customer akun login: via user.customerId, lalu fallback email sama
   *  dengan customer.email (demo lama). */
  public getCustomerByUserEmail(email: string): Customer | undefined {
    this.load();
    const normalized = email.toLowerCase();

    // 1. Prioritas 1: AppUser dengan role "customer" yang punya customerId
    const linkedUser = this.users.find(
      (u) => u.email.toLowerCase() === normalized && u.customerId,
    );
    if (linkedUser) {
      const linked = this.customers.find((c) => c.id === linkedUser.customerId);
      if (linked) return linked;
    }

    // 2. Prioritas 2 (fallback): customer yang email-nya sama persis
    return this.customers.find((c) => c.email?.toLowerCase() === normalized);
  }

  public getUserById(id: string): AppUser | undefined {
    this.load();
    return this.users.find((u) => u.id === id);
  }

  public getUserByEmail(email: string): AppUser | undefined {
    this.load();
    return this.users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase(),
    );
  }

  public createUser(data: Omit<AppUser, "id" | "createdAt">): AppUser {
    this.load();
    const id = `usr-${Date.now()}`;
    const newUser: AppUser = {
      ...data,
      id,
      createdAt: new Date().toISOString(),
    };
    this.users.unshift(newUser);
    this.save();
    return newUser;
  }

  public updateUser(
    id: string,
    updates: Partial<AppUser>,
  ): AppUser | undefined {
    this.load();
    const index = this.users.findIndex((u) => u.id === id);
    if (index === -1) return undefined;

    this.users[index] = {
      ...this.users[index],
      ...updates,
    };
    this.save();
    return this.users[index];
  }

  public deleteUser(id: string): boolean {
    this.load();
    if (this.users.length <= 1) return false; // Prevent deleting last user
    this.users = this.users.filter((u) => u.id !== id);
    this.save();
    return true;
  }

  // --- Dashboard Aggregation ---
  public getDashboardStats(): DashboardStats {
    this.load();
    const totalCustomers = this.customers.length;
    const activeCustomers = this.customers.filter(
      (c) => c.status === "active",
    ).length;
    const suspendedCustomers = this.customers.filter(
      (c) => c.status === "suspended",
    ).length;
    const onlineNow = this.sessions.filter((s) => !s.stoppedAt).length;

    const totalRoutersOnline = this.routers.filter(
      (r) => r.status === "online",
    ).length;
    const totalRoutersOffline = this.routers.filter(
      (r) => r.status === "offline",
    ).length;

    // Traffic today calculation.
    // Data mock "hidup": semua sesi aktif terus berjalan selama aplikasi
    // terbuka — pindahkan usianya ke nilai saat ini (live), panjang durasi
    // diperpanjang, dan trafik hari ini dihitung dari DATA LIVE terkini.
    const nowMs = Date.now();
    const today = new Date(nowMs).toISOString().slice(0, 10);
    const todaySessions = this.sessions.filter(
      (s) => !s.stoppedAt || s.startedAt.startsWith(today),
    );

    let totalDownload = todaySessions.reduce((acc, s) => {
      const live = s.stoppedAt ? s.outputBytes : this.liveBytesNow(s, nowMs);
      return acc + live;
    }, 0);
    let totalUpload = todaySessions.reduce((acc, s) => {
      const live = s.stoppedAt ? s.inputBytes : this.liveBytesNow(s, nowMs);
      return acc + live;
    }, 0);

    // If today is light on mock sessions, provide a realistic baseline (~84.5 GB)
    if (totalDownload === 0) {
      totalDownload = 68.4 * 1024 * 1024 * 1024;
      totalUpload = 16.1 * 1024 * 1024 * 1024;
    }

    const totalTrafficTodayBytes = totalDownload + totalUpload;

    // Generate 7-day usage trend
    const usageTrend: UsageTrendPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      });

      // Semi-randomized organic traffic variance
      const seed = ((i + 1) * 17) % 10;
      const baseDown = (55 + seed * 4.5) * 1024 * 1024 * 1024;
      const baseUp = (12 + seed * 1.8) * 1024 * 1024 * 1024;

      usageTrend.push({
        date: dateStr,
        downloadBytes: Math.round(baseDown),
        uploadBytes: Math.round(baseUp),
        bytes: Math.round(baseDown + baseUp),
      });
    }

    return {
      totalCustomers,
      activeCustomers,
      suspendedCustomers,
      onlineNow,
      totalRoutersOnline,
      totalRoutersOffline,
      totalTrafficTodayBytes,
      totalDownloadTodayBytes: totalDownload,
      totalUploadTodayBytes: totalUpload,
      usageTrend,
    };
  }

  // --- Customer 30-day History & Usage Chart ---
  public getCustomerUsageHistory(customerId: string): CustomerDailyUsage[] {
    this.load();
    const result: CustomerDailyUsage[] = [];
    const customer = this.customers.find((c) => c.id === customerId);
    if (!customer) return [];

    // Hash the customerId for consistent daily patterns
    const hash = customerId
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);

    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      });

      const daySeed = (hash + i * 13) % 100;
      const factor = (daySeed / 100) * 0.8 + 0.6; // 0.6 to 1.4 multiplier

      // Hari ini: tambahkan "live progress" — trafik naik seiring waktu
      // berjalan (cap per detik × 10), sehingga angka terus bertambah
      // dan terlihat seperti data real-time.
      const isToday = i === 0;
      const nowMs = Date.now();
      const liveBias = isToday
        ? Math.min(1, ((nowMs / 1000) % 86400) / 86400)
        : 0;
      const down = Math.round(
        factor * 2.8 * 1024 * 1024 * 1024 * (1 + liveBias * 0.5),
      ); // avg ~2.8 GB (+50% progresif hari ini)
      const up = Math.round(
        factor * 0.45 * 1024 * 1024 * 1024 * (1 + liveBias * 0.5),
      ); // avg ~450 MB

      result.push({
        date: dateStr,
        downloadBytes: down,
        uploadBytes: up,
        totalBytes: down + up,
        sessionsCount: (daySeed % 3) + 1,
      });
    }
    return result;
  }

  // --- Customer Monthly Usage (per tahun, 12 bulan per tahun) ---
  public getCustomerMonthlyUsage(
    customerId: string,
    year?: number,
  ): CustomerMonthlyUsage[] {
    this.load();
    const result: CustomerMonthlyUsage[] = [];
    const customer = this.customers.find((c) => c.id === customerId);
    if (!customer) return [];

    const hash = customerId
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);

    // Tanpa argumen year → 12 bulan terakhir (perilaku lama).
    // Dengan year → 12 bulan pada tahun tsb (Jan–Des), utk filter pertahun.
    const months: { d: Date; i: number }[] = [];
    if (year === undefined) {
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        months.push({ d, i });
      }
    } else {
      for (let i = 0; i < 12; i++) {
        months.push({ d: new Date(year, i, 1), i });
      }
    }

    for (const { d, i } of months) {
      const label = d.toLocaleDateString("id-ID", {
        month: "short",
        year: "numeric",
      });
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

      const monthSeed = (hash + i * 97) % 100;
      const factor = (monthSeed / 100) * 0.9 + 0.4; // 0.4 to 1.3 multiplier

      // Bulan berjalan: naikkan sedikit seiring hari berjalan dalam bulan
      // (progresif 0→+40%), sehingga "akumulasi bulan ini" terlihat bertambah.
      const now = new Date();
      const isCurrentMonth =
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
      const dayOfMonth = new Date().getDate();
      const monthBias = isCurrentMonth ? dayOfMonth / 30 : 1;

      const down = Math.round(
        factor * 50 * 1024 * 1024 * 1024 * (0.6 + monthBias * 0.4),
      ); // rata-rata ~50 GB/bln
      const up = Math.round(
        factor * 10 * 1024 * 1024 * 1024 * (0.6 + monthBias * 0.4),
      ); // rata-rata ~10 GB/bln

      result.push({
        month: monthStr,
        label,
        downloadBytes: down,
        uploadBytes: up,
        totalBytes: down + up,
        sessionsCount: Math.round((monthSeed % 20) + 18), // ~19-37 sesi/bln
      });
    }
    return result;
  }
}

export const mockDb = new MockDatabase();
