"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CheckCircle,
  CircleAlert,
  CircleX,
  Eye,
  EyeOff,
  Globe,
  Loader2,
  Network,
  Shield,
  Sparkles,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCustomer, updateCustomer } from "@/lib/api/customers";
import {
  generateCandidateUsername,
  generatePppoePassword,
} from "@/lib/generators";
import type {
  BandwidthProfile,
  Customer,
  CustomerStatus,
  NasRouter,
} from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

const ipv4Regex =
  /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

const customerSchema = z.object({
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .max(32, "Username maksimal 32 karakter")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username hanya boleh huruf, angka, titik, minus, dan underscore (tanpa spasi)",
    ),
  password: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 6, {
      message: "Password minimal 6 karakter jika diisi",
    }),
  email: z
    .string()
    .email("Format email tidak valid")
    .optional()
    .or(z.literal("")),
  portalPassword: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 6, {
      message: "Password portal minimal 6 karakter jika diisi",
    }),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  profileId: z.string().min(1, "Wajib memilih profil bandwidth"),
  staticIp: z
    .string()
    .optional()
    .refine((val) => !val || val === "" || ipv4Regex.test(val), {
      message: "Format IP Address tidak valid (contoh: 10.10.10.15)",
    }),
  nasId: z.string().optional(),
  bindOnNas: z.boolean().optional(),
  status: z.enum(["active", "suspended", "disabled"]),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerFormProps {
  initialData?: Customer;
  profiles: BandwidthProfile[];
  routers: NasRouter[];
  isEditing?: boolean;
}

export function CustomerForm({
  initialData,
  profiles,
  routers,
  isEditing = false,
}: CustomerFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showPppoePassword, setShowPppoePassword] = useState(false);
  const [showPortalPassword, setShowPortalPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      username: initialData?.username || "",
      password: "",
      email: initialData?.email || initialData?.portalUser?.email || "",
      portalPassword: "",
      fullName: initialData?.fullName || "",
      phone: initialData?.phone || "",
      address: initialData?.address || "",
      profileId: initialData?.profileId || profiles[0]?.id || "",
      staticIp: initialData?.staticIp || "",
      nasId: initialData?.nasId || routers[0]?.id || "",
      bindOnNas: initialData?.bindOnNas ?? false,
      status: initialData?.status || "active",
    },
  });

  // Otomatis generate username & password PPPoE saat buat pelanggan baru
  useEffect(() => {
    if (!isEditing && !initialData) {
      setValue("username", generateCandidateUsername(), {
        shouldValidate: true,
      });
      setValue("password", generatePppoePassword(), { shouldValidate: true });
    }
  }, [isEditing, initialData, setValue]);

  const selectedProfileId = watch("profileId");
  const selectedStatus = watch("status");
  const selectedNasId = watch("nasId");
  const bindOnNas = watch("bindOnNas");
  const _currentUsername = watch("username");
  const _currentPassword = watch("password");

  const handleRegenerateUsername = () => {
    setValue("username", generateCandidateUsername(), { shouldValidate: true });
  };

  const handleRegeneratePassword = () => {
    setValue("password", generatePppoePassword(), { shouldValidate: true });
  };

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      setSubmitting(true);
      if (isEditing && initialData) {
        await updateCustomer(initialData.id, {
          username: data.username,
          ...(data.password ? { password: data.password } : {}),
          email: data.email || undefined,
          portalPassword: data.portalPassword || undefined,
          fullName: data.fullName,
          phone: data.phone,
          address: data.address,
          profileId: data.profileId,
          staticIp: data.staticIp || undefined,
          nasId: data.nasId || undefined,
          bindOnNas: data.bindOnNas,
          status: data.status as CustomerStatus,
        });
        toast.success(`Data pelanggan ${data.username} berhasil diperbarui.`);
        router.push(`/customers/${initialData.id}`);
      } else {
        const created = await createCustomer({
          username: data.username,
          password: data.password || generatePppoePassword(),
          email: data.email || undefined,
          portalPassword: data.portalPassword || undefined,
          fullName: data.fullName,
          phone: data.phone,
          address: data.address,
          profileId: data.profileId,
          staticIp: data.staticIp || undefined,
          nasId: data.nasId || undefined,
          bindOnNas: data.bindOnNas,
          status: data.status as CustomerStatus,
        });
        toast.success(
          `Pelanggan baru ${created.username} berhasil ditambahkan!`,
        );
        router.push("/customers");
      }
    } catch (err: unknown) {
      toast.error(
        getErrorMessage(err) ||
          "Terjadi kesalahan saat menyimpan data pelanggan.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="gap-2 text-slate-600 dark:text-slate-400"
        >
          <Link
            href={
              isEditing && initialData
                ? `/customers/${initialData.id}`
                : "/customers"
            }
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Section 1: PPPoE & RADIUS Authentication */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Shield className="h-5 w-5" />
              <CardTitle className="text-base">
                Kredensial RADIUS PPPoE
              </CardTitle>
            </div>
            <CardDescription>
              Kredensial dial koneksi internet yang disinkronkan ke FreeRADIUS (
              <code className="text-xs">radcheck</code>) dan MikroTik PPPoE
              Server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Username PPPoE */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="username">
                  Username PPPoE <span className="text-rose-500">*</span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerateUsername}
                  className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Acak Username
                </Button>
              </div>
              <Input
                id="username"
                placeholder="mis. user_892341"
                {...register("username")}
                className={
                  errors.username ? "border-rose-500 font-mono" : "font-mono"
                }
              />
              {errors.username ? (
                <p className="text-xs text-rose-500">
                  {errors.username.message}
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Dibuat otomatis oleh sistem (dijamin unik). Anda tetap dapat
                  mengubahnya secara manual.
                </p>
              )}
            </div>

            {/* Password PPPoE */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">
                  Password PPPoE{" "}
                  {!isEditing && <span className="text-rose-500">*</span>}
                </Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPppoePassword(!showPppoePassword)}
                    className="h-7 px-2 text-xs text-slate-500"
                  >
                    {showPppoePassword ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5 mr-1" /> Sembunyikan
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5 mr-1" /> Tampilkan
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRegeneratePassword}
                    className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Acak Password
                  </Button>
                </div>
              </div>
              <Input
                id="password"
                type={showPppoePassword ? "text" : "password"}
                placeholder={
                  isEditing
                    ? "Kosongkan jika tidak ingin mengubah password PPPoE"
                    : "Minimal 6 karakter"
                }
                {...register("password")}
                className={
                  errors.password ? "border-rose-500 font-mono" : "font-mono"
                }
              />
              {errors.password && (
                <p className="text-xs text-rose-500">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Profil Paket Bandwidth */}
            <div className="space-y-2">
              <Label htmlFor="profileId">
                Profil Paket Bandwidth <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={selectedProfileId}
                onValueChange={(val) =>
                  setValue("profileId", val, { shouldValidate: true })
                }
              >
                <SelectTrigger id="profileId">
                  <SelectValue placeholder="Pilih Profil Paket" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.rateLimitDown}M / {p.rateLimitUp}M)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.profileId && (
                <p className="text-xs text-rose-500">
                  {errors.profileId.message}
                </p>
              )}
            </div>

            {/* Status Akun Pelanggan */}
            <div className="space-y-2">
              <Label htmlFor="status">Status Layanan Pelanggan</Label>
              <Select
                value={selectedStatus}
                onValueChange={(val) =>
                  setValue("status", val as CustomerStatus, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Pilih Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-green-500 h-4 w-4" /> Active
                      (Aktif)
                    </div>
                  </SelectItem>
                  <SelectItem value="suspended">
                    <div className="flex items-center gap-2">
                      <CircleAlert className="text-yellow-500 h-4 w-4" />{" "}
                      Suspended (Isolir / Ditangguhkan)
                    </div>
                  </SelectItem>
                  <SelectItem value="disabled">
                    <div className="flex items-center gap-2">
                      <CircleX className="text-red-500 h-4 w-4" /> Disabled
                      (Nonaktif)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Network & MikroTik NAS */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Network className="h-5 w-5" />
              <CardTitle className="text-base">
                Pengaturan Jaringan (Framed-IP & NAS)
              </CardTitle>
            </div>
            <CardDescription>
              Konfigurasi IP statis (
              <code className="text-xs">radreply: Framed-IP-Address</code>) &
              router NAS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="staticIp">IP Statis (Opsional)</Label>
              <Input
                id="staticIp"
                placeholder="Kosongkan jika menggunakan Dynamic IP Pool"
                {...register("staticIp")}
                className={errors.staticIp ? "border-rose-500" : ""}
              />
              <p className="text-[11px] text-slate-500">
                Jika diisi, router MikroTik akan selalu memberikan IP ini ke
                pelanggan.
              </p>
              {errors.staticIp && (
                <p className="text-xs text-rose-500">
                  {errors.staticIp.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nasId">Default NAS Router (MikroTik)</Label>
              <Select
                value={selectedNasId}
                onValueChange={(val) =>
                  setValue("nasId", val, { shouldValidate: true })
                }
              >
                <SelectTrigger id="nasId" disabled={!bindOnNas}>
                  <SelectValue placeholder="Pilih NAS Router" />
                </SelectTrigger>
                <SelectContent>
                  {routers.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({r.ipAddress})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 cursor-pointer dark:border-slate-800">
                <input
                  type="checkbox"
                  checked={bindOnNas}
                  onChange={(e) =>
                    setValue("bindOnNas", e.target.checked, {
                      shouldValidate: true,
                    })
                  }
                  className="mt-0.5 h-4 w-4 accent-blue-600"
                />
                <span className="text-sm leading-snug">
                  <span className="font-medium">Bind-on-NAS</span>
                  <span className="block text-xs text-slate-500">
                    Kunci login PPPoE hanya boleh lewat router yang dipilih
                    (ditulis sebagai radcheck <code>NAS-IP-Address</code> agar
                    FreeRADIUS menolak login dari router lain).
                  </span>
                </span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Customer Metadata & Portal Account */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <User className="h-5 w-5" />
              <CardTitle className="text-base">
                Identitas Pelanggan & Akun Portal Self-Care
              </CardTitle>
            </div>
            <CardDescription>
              Data pelanggan dan akun untuk masuk ke Portal Pelanggan Self-Care
              (<code className="text-xs">/portal</code>).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nama Lengkap Pelanggan</Label>
                <Input
                  id="fullName"
                  placeholder="mis. Budi Santoso"
                  {...register("fullName")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Nomor Telepon / WhatsApp</Label>
                <Input
                  id="phone"
                  placeholder="mis. 081234567890"
                  {...register("phone")}
                />
              </div>
            </div>

            {/* Pemisahan akun portal */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Akun Portal Pelanggan (Self-Care Web)</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pelanggan dapat login ke web <code>/portal</code> menggunakan
                Email & Password ini untuk melihat tagihan, riwayat pemakaian,
                dan status jaringan secara mandiri.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Pelanggan (Login Portal)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="mis. budi@gmail.com"
                    {...register("email")}
                    className={errors.email ? "border-rose-500" : ""}
                  />
                  {errors.email && (
                    <p className="text-xs text-rose-500">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="portalPassword">Password Portal</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPortalPassword(!showPortalPassword)}
                      className="h-6 px-1.5 text-xs text-slate-500"
                    >
                      {showPortalPassword ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <Input
                    id="portalPassword"
                    type={showPortalPassword ? "text" : "password"}
                    placeholder={
                      isEditing
                        ? "Kosongkan jika tidak ingin mengubah password portal"
                        : "Default: password123"
                    }
                    {...register("portalPassword")}
                    className={errors.portalPassword ? "border-rose-500" : ""}
                  />
                  {errors.portalPassword && (
                    <p className="text-xs text-rose-500">
                      {errors.portalPassword.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Alamat Pemasangan</Label>
              <Input
                id="address"
                placeholder="mis. Jl. Merpati No. 12, RT 01/RW 03"
                {...register("address")}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={submitting}
        >
          Batal
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Simpan Perubahan" : "Tambah Pelanggan"}
        </Button>
      </div>
    </form>
  );
}
