import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { prisma } from "./prisma";

/**
 * Better Auth — INSTANCE #1: user SISTEM (admin/operator).
 * RBAC via `roleId` → Role. Plugin username untuk login pakai username.
 * Pakai tabel terpisah (app_user, app_session, ...) via modelName.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: {
    enabled: true,
  },
  plugins: [username()],
  user: {
    modelName: "appUser",
    fields: {
      name: "name",
      email: "email",
      emailVerified: "emailVerified",
      image: "image",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    additionalFields: {
      role: { type: "string", required: false, input: false },
      roleId: { type: "string", required: false, input: false },
      status: { type: "string", required: false, input: false },
      lastLoginAt: { type: "date", required: false, input: false },
    },
  },
  session: {
    modelName: "appSession",
    cookieCache: { enabled: true, maxAge: 60 * 60 },
  },
  account: {
    modelName: "appAccount",
  },
  verification: {
    modelName: "appVerification",
  },
  advanced: {
    cookiePrefix: "microrad_app",
    defaultCookieAttributes: {
      sameSite: "lax",
    },
  },
});

export type AppSession = typeof auth.$Infer.Session;
