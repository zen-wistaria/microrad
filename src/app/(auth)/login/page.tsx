"use client";

import {
  Briefcase,
  Home,
  Loader2,
  Lock,
  Mail,
  Radio,
  Shield,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
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
import { getUserByEmail } from "@/lib/api/users";
import { useAuth } from "@/lib/auth";
import { initialUsers } from "@/lib/mock/users.mock";
import { getErrorMessage } from "@/lib/utils";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@microrad.net");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);

  const demoAccounts = [
    {
      email: "admin@microrad.net",
      label: "Admin",
      sub: "Akses Penuh",
      icon: Shield,
      color: "text-purple-600",
    },
    {
      email: "manager@microrad.net",
      label: "Manager",
      sub: "Operasional & Keuangan",
      icon: Briefcase,
      color: "text-blue-600",
    },
    {
      email: "operator@microrad.net",
      label: "Operator",
      sub: "NOC & Monitoring",
      icon: User,
      color: "text-sky-600",
    },
    {
      email: "budi.santoso@mail.com",
      label: "Pelanggan",
      sub: "Portal Pelanggan",
      icon: Home,
      color: "text-emerald-600",
    },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Find matching user from mock
      const user = await getUserByEmail(email);
      if (!user) {
        toast.error("Email tidak ditemukan di sistem.");
        setLoading(false);
        return;
      }

      if (user.status === "disabled") {
        toast.error("Akun Anda telah dinonaktifkan oleh Administrator.");
        setLoading(false);
        return;
      }

      login(user);
      toast.success(`Selamat datang kembali, ${user.name}!`);
      router.push(user.role === "customer" ? "/portal" : "/dashboard");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal melakukan login.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword("password123");
    const user = initialUsers.find((u) => u.email === demoEmail);
    if (user) {
      login(user);
      toast.success(`Login demo berhasil sebagai ${user.name}!`);
      router.push(user.role === "customer" ? "/portal" : "/dashboard");
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 dark:bg-slate-950 sm:p-8">
      {/* Background ambient accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/20 mb-2">
            <Radio className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            MicroRAD
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Portal Manajemen PPPoE & RADIUS MikroTik
          </p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-200/80 shadow-xl backdrop-blur-sm dark:border-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Login App User</CardTitle>
            <CardDescription>
              Masuk dengan akun administrator atau operator NOC Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Pengguna</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@microrad.net"
                    required
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
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="pl-9"
                  />
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

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  Atau Coba Akun Demo
                </span>
              </div>
            </div>

            {/* Quick Demo Access Buttons (RBAC) */}
            <div className="grid grid-cols-2 gap-2.5">
              {demoAccounts.map((demo) => (
                <Button
                  key={demo.email}
                  type="button"
                  variant="outline"
                  onClick={() => handleDemoLogin(demo.email)}
                  className="flex items-center justify-center gap-1.5 h-auto py-2.5 px-3 text-xs"
                >
                  <demo.icon className={`h-4 w-4 ${demo.color}`} />
                  <div className="text-left leading-tight">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {demo.label}
                    </div>
                    <div className="text-[10px] text-slate-500">{demo.sub}</div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
          <CardFooter className="border-t border-slate-100 pt-4 text-center text-xs text-slate-500 dark:border-slate-800/80">
            MicroRAD v0.2 • FreeRADIUS Free Mock Environment
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
