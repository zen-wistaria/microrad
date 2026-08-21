import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Client Better Auth instance #2 (portal pelanggan) — basePath /api/auth/portal.
 * baseURL wajib absolut; diisi dari window origin saat runtime.
 */
export const portalAuthClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? `${window.location.origin}/api/auth/portal`
      : "http://localhost:3000/api/auth/portal",
  plugins: [usernameClient()],
});

export const {
  useSession: usePortalSession,
  signIn: portalSignIn,
  signOut: portalSignOut,
} = portalAuthClient;
