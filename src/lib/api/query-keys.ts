import type { GetBandwidthsParams } from "./bandwidths";
import type { GetInvoicesParams } from "./billing";
import type { GetCustomersParams } from "./customers";
import type { GetInternetProfilesParams } from "./internet-profiles";
import type { GetLogsParams } from "./logs";
import type { GetProfileGroupsParams } from "./profile-groups";
import type { GetProfilesParams } from "./profiles";
import type { GetRoutersParams } from "./routers";
import type { GetSessionsParams } from "./sessions";
import type { GetUsersParams } from "./users";

/**
 * Standard Query Keys Hierarki untuk TanStack Query v5
 * Memudahkan query matching, caching, dan selective invalidation.
 */
export const queryKeys = {
  // Dashboard
  dashboard: ["dashboard"] as const,

  // Customers
  customers: {
    all: ["customers"] as const,
    list: (params?: GetCustomersParams) =>
      ["customers", "list", ...(params ? [params] : [])] as const,
    detail: (id: string) => ["customers", "detail", id] as const,
    activeSession: (id: string) => ["customers", "active-session", id] as const,
    sessions: (
      id: string,
      filter?: { year?: number; month?: number; page?: number; limit?: number },
    ) => ["customers", "sessions", id, ...(filter ? [filter] : [])] as const,
    usageHistory: (id: string, filter?: { year?: number; month?: number }) =>
      ["customers", "usage-history", id, ...(filter ? [filter] : [])] as const,
    monthlyUsage: (id: string, year: number) =>
      ["customers", "monthly-usage", id, year] as const,
  },

  // Bandwidths
  bandwidths: {
    all: ["bandwidths"] as const,
    list: (params?: GetBandwidthsParams) =>
      ["bandwidths", "list", ...(params ? [params] : [])] as const,
    detail: (id: string) => ["bandwidths", "detail", id] as const,
  },

  // Profile Groups
  profileGroups: {
    all: ["profile-groups"] as const,
    list: (params?: GetProfileGroupsParams) =>
      ["profile-groups", "list", ...(params ? [params] : [])] as const,
    detail: (id: string) => ["profile-groups", "detail", id] as const,
  },

  // Internet Profiles (Paket Layanan)
  internetProfiles: {
    all: ["internet-profiles"] as const,
    list: (params?: GetInternetProfilesParams) =>
      ["internet-profiles", "list", ...(params ? [params] : [])] as const,
    detail: (id: string) => ["internet-profiles", "detail", id] as const,
  },

  // Profiles (Node MikroTik - PPP & Hotspot)
  profiles: {
    all: ["profiles"] as const,
    list: (params?: GetProfilesParams) =>
      ["profiles", "list", ...(params ? [params] : [])] as const,
    detail: (id: string) => ["profiles", "detail", id] as const,
  },

  // PPP Profiles (alias)
  pppProfiles: {
    all: ["profiles"] as const,
    list: (params?: GetProfilesParams) =>
      ["profiles", "list", ...(params ? [params] : [])] as const,
    detail: (id: string) => ["profiles", "detail", id] as const,
  },

  // NAS Routers
  routers: {
    all: ["routers"] as const,
    list: (params?: GetRoutersParams) =>
      ["routers", "list", ...(params ? [params] : [])] as const,
    detail: (id: string) => ["routers", "detail", id] as const,
  },

  // PPPoE Sessions
  sessions: {
    all: ["sessions"] as const,
    list: (params?: GetSessionsParams) =>
      ["sessions", "list", ...(params ? [params] : [])] as const,
  },

  // Billing
  billing: {
    all: ["billing"] as const,
    invoices: (params?: GetInvoicesParams) =>
      ["billing", "invoices", ...(params ? [params] : [])] as const,
    payments: (params?: {
      paysearch?: string;
      page?: number;
      limit?: number;
      customerId?: string;
    }) => ["billing", "payments", ...(params ? [params] : [])] as const,
    invoiceDetail: (id: string) => ["billing", "invoice", id] as const,
    summary: ["billing", "summary"] as const,
    months: ["billing", "months"] as const,
  },

  // Users & RBAC
  users: {
    all: ["users"] as const,
    list: (params?: GetUsersParams) =>
      ["users", "list", ...(params ? [params] : [])] as const,
    detail: (id: string) => ["users", "detail", id] as const,
  },
  roles: {
    all: ["roles"] as const,
    detail: (id: string) => ["roles", "detail", id] as const,
  },

  // Audit Logs
  logs: {
    all: ["logs"] as const,
    list: (params?: GetLogsParams) =>
      ["logs", "list", ...(params ? [params] : [])] as const,
  },

  // Settings
  settings: ["settings"] as const,

  // Customer Self-Care Portal
  portal: {
    me: ["portal", "me"] as const,
  },
};
