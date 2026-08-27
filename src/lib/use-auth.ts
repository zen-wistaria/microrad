"use client";

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
  username?: string | null;
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
    username:
      typeof sessionUser.username === "string"
        ? sessionUser.username
        : undefined,
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
  const { data: appSession, isPending: appLoading } = authClient.useSession();
  const { data: portalSession, isPending: portalLoading } =
    portalAuthClient.useSession();

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

  // isLoading HANYA bernilai true pada initial check ketika belum ada user terdeteksi.
  // Jika user sudah teridentifikasi (status active), background revalidation
  // (misal saat tab focus / window focus) TIDAK memicu isLoading = true
  // agar layout tidak berkedip dan form yang sedang diedit tidak ter-unmount.
  const isLoading = !isAuthenticated && (appLoading || portalLoading);

  const login = useCallback(
    async (emailOrUsername: string, password: string) => {
      // Hanya autentikasi untuk User Sistem (AppUser: Admin/Manager/Operator/NOC).
      // Customer/Pelanggan diwajibkan login melalui Portal Pelanggan (/portal/login).
      const identifier = emailOrUsername.trim();
      const isEmail = identifier.includes("@");

      let appRes: { error?: { message?: string } | null };
      if (isEmail) {
        appRes = await authClient.signIn.email({
          email: identifier,
          password,
        });
      } else {
        // Login menggunakan plugin username Better-Auth
        appRes = await authClient.signIn.username({
          username: identifier,
          password,
        });
      }

      if (appRes.error) {
        throw new Error(
          appRes.error.message ?? "Email/username atau password salah.",
        );
      }
      return { area: "app" as const };
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await appSignOut();
      await portalSignOut();
    } catch {
      // abaikan error jika sesi sudah terhapus
    }
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
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
      logout,
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
    ],
  );
}
