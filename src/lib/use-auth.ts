"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { signOut as appSignOut, authClient } from "@/lib/auth-client";
import { portalAuthClient, portalSignOut } from "@/lib/auth-portal-client";
import type { AppUser } from "@/lib/types";

/**
 * Hook auth frontend — menggantikan useAuth lama (localStorage).
 * Baca sesi Better Auth instance #1 (user sistem) & #2 (portal).
 * Bentuk return dipertahankan agar komponen tidak berubah:
 *   { currentUser, isLoading, isAuthenticated, isAdmin, login, logout }
 */
type SessionUser = {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  status?: string | null;
  createdAt?: string | Date | null;
  lastLoginAt?: string | Date | null;
  [key: string]: unknown;
};

function toAppUser(
  sessionUser: SessionUser | null | undefined,
): AppUser | null {
  if (!sessionUser) return null;
  const roleId =
    typeof sessionUser.roleId === "string" ? sessionUser.roleId : undefined;
  return {
    id: sessionUser.id,
    name: sessionUser.name,
    email: sessionUser.email,
    role: (sessionUser.role as AppUser["role"]) ?? "operator",
    roleId,
    status: (sessionUser.status as AppUser["status"]) ?? "active",
    createdAt: (sessionUser.createdAt as string) ?? new Date().toISOString(),
    lastLoginAt: sessionUser.lastLoginAt
      ? (sessionUser.lastLoginAt as string)
      : undefined,
  };
}

export function useAuth() {
  const router = useRouter();
  const { data: appSession, isPending: appLoading } = authClient.useSession();
  const { data: portalSession, isPending: portalLoading } =
    portalAuthClient.useSession();

  const isLoading = appLoading || portalLoading;
  const appUser = toAppUser(appSession?.user);
  const portalUser = toAppUser(portalSession?.user);

  // Sesuatu harus kompatibel dengan ekspektasi lama: currentUser = user sistem
  // (portal area menangani sesi portal sendiri di layout-nya). Jika tidak ada
  // sesi sistem tapi ada sesi portal, currentUser = user portal (untuk
  // redirect-ke-portal di layout).
  const currentUser = appUser ?? portalUser ?? null;
  const isAuthenticated = Boolean(appUser || portalUser);
  const isAdmin =
    currentUser?.roleId === "role-admin" || currentUser?.role === "admin";

  const login = useCallback(async (email: string, password: string) => {
    // Coba instance #1 (user sistem) dulu; bila gagal, coba portal.
    const appRes = await authClient.signIn.email({ email, password });
    if (appRes.error) {
      const portalRes = await portalAuthClient.signIn.email({
        email,
        password,
      });
      if (portalRes.error) {
        throw new Error(
          portalRes.error.message ??
            appRes.error.message ??
            "Email atau password salah.",
        );
      }
      return { area: "portal" as const };
    }
    return { area: "app" as const };
  }, []);

  const logout = useCallback(async () => {
    await appSignOut();
    await portalSignOut();
  }, []);

  return useMemo(
    () => ({
      currentUser,
      appUser,
      portalUser,
      isLoading,
      isAuthenticated,
      isAdmin,
      login,
      logout: async () => {
        await logout();
        router.replace("/login");
      },
    }),
    [
      currentUser,
      appUser,
      portalUser,
      isLoading,
      isAuthenticated,
      isAdmin,
      login,
      logout,
      router,
    ],
  );
}
