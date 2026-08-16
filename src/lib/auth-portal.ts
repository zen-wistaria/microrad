import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { prisma } from "./prisma";

/**
 * Better Auth — INSTANCE #2: user PORTAL pelanggan.
 * Login pakai email + password; akun terhubung ke Customer via customerId.
 * Pakai tabel terpisah (portal_user, portal_session, ...) via modelName.
 */
export const authPortal = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  basePath: "/api/auth/portal",
  secret: process.env.PORTAL_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET,
  baseURL: `${process.env.BETTER_AUTH_URL ?? "http://localhost:3000"}/api/auth/portal`,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    modelName: "portalUser",
    fields: {
      name: "name",
      email: "email",
      emailVerified: "emailVerified",
      image: "image",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  },
  session: {
    modelName: "portalSession",
    cookieCache: { enabled: true, maxAge: 60 * 60 },
  },
  account: {
    modelName: "portalAccount",
  },
  verification: {
    modelName: "portalVerification",
  },
  advanced: {
    cookiePrefix: "microrad_portal",
    defaultCookieAttributes: {
      sameSite: "lax",
    },
  },
});

export type PortalSession = typeof authPortal.$Infer.Session;
