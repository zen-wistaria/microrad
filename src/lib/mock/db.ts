import type {
  AppUser,
  BandwidthProfile,
  Customer,
  CustomerDailyUsage,
  DashboardStats,
  NasRouter,
  Session,
  UsageTrendPoint,
} from "../types";
import { initialCustomers } from "./customers.mock";
import { initialProfiles } from "./profiles.mock";
import { initialRouters } from "./routers.mock";
import { initialSessions } from "./sessions.mock";
import { initialUsers } from "./users.mock";

const STORAGE_KEYS = {
  CUSTOMERS: "microrad_customers",
  PROFILES: "microrad_profiles",
  ROUTERS: "microrad_routers",
  SESSIONS: "microrad_sessions",
  USERS: "microrad_users",
  INITIALIZED: "microrad_initialized_v1",
};

class MockDatabase {
  private customers: Customer[] = [];
  private profiles: BandwidthProfile[] = [];
  private routers: NasRouter[] = [];
  private sessions: Session[] = [];
  private users: AppUser[] = [];
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
    if (!this.isBrowser()) {
      // Server-side default
      this.customers = [...initialCustomers];
      this.profiles = [...initialProfiles];
      this.routers = [...initialRouters];
      this.sessions = [...initialSessions];
      this.users = [...initialUsers];
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

        this.customers = storedCustomers
          ? JSON.parse(storedCustomers)
          : [...initialCustomers];
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
    } catch (e) {
      console.error("Failed to save state to localStorage", e);
    }
  }

  public resetToDefaults(): void {
    this.customers = JSON.parse(JSON.stringify(initialCustomers));
    this.profiles = JSON.parse(JSON.stringify(initialProfiles));
    this.routers = JSON.parse(JSON.stringify(initialRouters));
    this.sessions = JSON.parse(JSON.stringify(initialSessions));
    this.users = JSON.parse(JSON.stringify(initialUsers));
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

    // Sort by startedAt descending
    return list.sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  }

  public getActiveSessionForCustomer(customerId: string): Session | undefined {
    this.load();
    return this.sessions.find(
      (s) => s.customerId === customerId && !s.stoppedAt,
    );
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

  // --- App Users CRUD ---
  public getUsers(): AppUser[] {
    this.load();
    return [...this.users];
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

    // Traffic today calculation
    const today = new Date().toISOString().slice(0, 10);
    const todaySessions = this.sessions.filter((s) =>
      s.startedAt.startsWith(today),
    );

    let totalDownload = todaySessions.reduce(
      (acc, s) => acc + s.outputBytes,
      0,
    );
    let totalUpload = todaySessions.reduce((acc, s) => acc + s.inputBytes, 0);

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

      const down = Math.round(factor * 2.8 * 1024 * 1024 * 1024); // avg ~2.8 GB
      const up = Math.round(factor * 0.45 * 1024 * 1024 * 1024); // avg ~450 MB

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
}

export const mockDb = new MockDatabase();
