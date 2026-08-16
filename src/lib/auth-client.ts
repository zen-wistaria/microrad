import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Client Better Auth instance #1 (user sistem) — basePath /api/auth.
 * baseURL wajib absolut; diisi dari window origin saat runtime.
 */
export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? `${window.location.origin}/api/auth`
      : "http://localhost:3000/api/auth",
  plugins: [usernameClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
