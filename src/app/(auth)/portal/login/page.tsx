"use client";

import { Globe, Loader2, Lock, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/common/theme-toggle";
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

export default function PortalLoginPage() {
  const router = useRouter();
  const { appUser, portalUser, isLoading } = useAuth();
  const [email, setEmail] = useState("budi.santoso@mail.com");
  const [password, setPassword] = useState("password123");
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
    setLoading(true);

    try {
      const res = await portalAuthClient.signIn.email({ email, password });
      if (res.error) {
        throw new Error(
          res.error.message || "Email atau password portal salah.",
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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-950 sm:p-8">
      {/* Tombol switch tema (pojok kanan atas) */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      {/* Background ambient accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-tr from-emerald-600 to-teal-600 text-white shadow-xl shadow-emerald-500/20 mb-2">
            <Globe className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Customer Self-Care
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Portal Layanan Mandiri Pelanggan Internet
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-200/80 shadow-xl backdrop-blur-sm dark:border-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Masuk ke Portal</CardTitle>
            <CardDescription>
              Gunakan email terdaftar untuk melihat tagihan, riwayat pemakaian,
              dan status jaringan Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePortalLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Terdaftar</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@domain.com"
                    required
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
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pl-9"
                  />
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
            <div className="text-[11px] text-slate-400">
              MicroRAD v0.2 • Self-Care Portal
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
