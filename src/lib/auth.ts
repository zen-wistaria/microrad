"use client";

import { useEffect, useState } from "react";
import { initialUsers } from "./mock/users.mock";
import type { AppUser } from "./types";

const AUTH_STORAGE_KEY = "microrad_auth_user";

export function getStoredUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  try {
    const item = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!item) {
      // Default to first user (Admin) if not set
      const defaultUser = initialUsers[0];
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(defaultUser));
      return defaultUser;
    }
    return JSON.parse(item);
  } catch {
    return initialUsers[0];
  }
}

export function setStoredUser(user: AppUser | null): void {
  if (typeof window === "undefined") return;
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);
    setIsLoading(false);

    const handleStorageChange = () => {
      setCurrentUser(getStoredUser());
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const login = (user: AppUser) => {
    setStoredUser(user);
    setCurrentUser(user);
  };

  const logout = () => {
    setStoredUser(null);
    setCurrentUser(null);
  };

  return {
    currentUser,
    isLoading,
    isAuthenticated: !!currentUser,
    isAdmin: currentUser?.role === "admin",
    login,
    logout,
  };
}
