import { prismaAdapter } from "@better-auth/prisma-adapter";
import { APIError, betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { recordPortalLogin } from "./api-auth";
import { prisma } from "./prisma";

/**
 * Better Auth — INSTANCE #2: user PORTAL pelanggan.
 * Login pakai email/username + password; akun terhubung ke Customer via customerId.
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
  plugins: [username()],
  user: {
    modelName: "portalUser",
    fields: {
      name: "name",
      username: "username",
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
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const portalUser = await prisma.portalUser.findUnique({
            where: { id: session.userId },
            include: { customer: true },
          });
          if (!portalUser?.customer) {
            throw new APIError("FORBIDDEN", {
              message: "Akun portal tidak terhubung ke data pelanggan aktif.",
            });
          }
          if (portalUser.customer.status === "disabled") {
            throw new APIError("FORBIDDEN", {
              message:
                "Akun pelanggan Anda berstatus Nonaktif (Disabled). Silakan hubungi customer service / administrator.",
            });
          }
        },
        after: async (session) => {
          // Catat login portal pelanggan → PortalLoginLog ("Portal Langganan")
          try {
            await recordPortalLogin(session.userId);
          } catch (err) {
            console.error("[auth-portal] gagal catat login portal:", err);
          }
        },
      },
    },
  },
});

export type PortalSession = typeof authPortal.$Infer.Session;
