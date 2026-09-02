"use client";

import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { portalAuthClient } from "@/lib/auth-portal-client";
import { useAuth } from "@/lib/use-auth";
import { getErrorMessage } from "@/lib/utils";

export function PortalLoginForm() {
  const router = useRouter();
  const { appUser, portalUser, isLoading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto redirect jika sudah login
  useEffect(() => {
    if (isLoading) return;
    if (portalUser) {
      router.replace("/portal");
    } else if (appUser) {
      router.replace("/dashboard");
    }
  }, [portalUser, appUser, isLoading, router]);

  const handlePortalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error("Mohon masukkan email atau username PPPoE Anda.");
      return;
    }
    if (!password) {
      toast.error("Mohon masukkan password portal Anda.");
      return;
    }

    setLoading(true);
    try {
      const isEmail = identifier.includes("@");
      const res = isEmail
        ? await portalAuthClient.signIn.email({
            email: identifier.trim(),
            password,
          })
        : await portalAuthClient.signIn.username({
            username: identifier.trim(),
            password,
          });

      if (res.error) {
        throw new Error(
          res.error.message || "Email/username atau password portal salah.",
        );
      }
      toast.success("Selamat datang di Portal Pelanggan!");
      router.replace("/portal");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal masuk ke portal pelanggan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-slate-200/80 shadow-xl backdrop-blur-sm dark:border-slate-800">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Masuk ke Portal</CardTitle>
        <CardDescription>
          Gunakan email terdaftar atau username PPPoE untuk melihat tagihan,
          riwayat pemakaian, dan status jaringan Anda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePortalLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Email atau Username PPPoE</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="mis. cust_202608210001 atau nama@mail.com"
                required
                autoComplete="username"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password Portal</Label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi portal..."
                required
                className="pl-9 pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memverifikasi...
              </>
            ) : (
              "Masuk ke Portal Pelanggan"
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-center text-xs text-slate-500 dark:border-slate-800/80">
        <div>
          Administrator / Operator NOC?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Login Manajemen &rarr;
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}

export default PortalLoginForm;
