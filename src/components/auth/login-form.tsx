"use client";

import { Eye, EyeOff, Loader2, Lock, User } from "lucide-react";
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
import { useAuth } from "@/lib/use-auth";
import { getErrorMessage } from "@/lib/utils";

export function LoginForm() {
  const router = useRouter();
  const { login, appUser, portalUser, isLoading } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto redirect jika sudah login
  useEffect(() => {
    if (isLoading) return;
    if (appUser) {
      router.replace("/dashboard");
    } else if (portalUser) {
      router.replace("/portal");
    }
  }, [appUser, portalUser, isLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error("Mohon masukkan email atau username Anda.");
      return;
    }
    if (!password) {
      toast.error("Mohon masukkan password akun Anda.");
      return;
    }

    setLoading(true);
    try {
      await login(identifier, password);
      toast.success("Login manajemen berhasil!");
      router.replace("/dashboard");
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(err) || "Email/username atau password akun salah.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-slate-200/80 shadow-xl backdrop-blur-sm dark:border-slate-800">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Login Manajemen</CardTitle>
        <CardDescription>
          Khusus Administrator &amp; Operator NOC. Pelanggan wajib masuk melalui
          Portal Pelanggan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Email atau Username</Label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="john doe atau johndoe@microrad.net"
                required
                autoComplete="username"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi..."
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

          <Button type="submit" className="w-full mt-2" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memverifikasi...
              </>
            ) : (
              "Masuk ke Dashboard"
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t border-slate-100 pt-4 text-center text-xs text-slate-500 dark:border-slate-800/80">
        <div>
          Pelanggan Internet?{" "}
          <Link
            href="/portal/login"
            className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Masuk ke Portal Pelanggan &rarr;
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}

export default LoginForm;
