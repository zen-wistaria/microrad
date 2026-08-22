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
  Layers,
  Loader2,
  Network,
  RefreshCw,
  Router as RouterIcon,
  Shield,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
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
import {
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
} from "@/lib/api/hooks";
import { generatePppoePassword } from "@/lib/generators";
import type {
  Customer,
  CustomerStatus,
  NasRouter,
  PppProfile,
} from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

const ipv4Regex =
  /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

const customerSchema = z.object({
  username: z.string().optional(),
  password: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 6, {
      message: "Password minimal 6 karakter jika diisi",
    }),
  email: z
    .string()
    .optional()
    .refine(
      (val) =>
        !val ||
        val.trim() === "" ||
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()),
      {
        message: "Format email tidak valid",
      },
    ),
  portalPassword: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 6, {
      message: "Password portal minimal 6 karakter jika diisi",
    }),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  profileId: z.string().min(1, "Wajib memilih paket PPP Profile"),
  staticIp: z
    .string()
    .optional()
    .refine((val) => !val || val === "" || ipv4Regex.test(val), {
      message: "Format IP Address tidak valid (contoh: 10.10.10.15)",
    }),
  nasId: z.string().optional(),
  bindOnNas: z.boolean().optional(),
  sessionMode: z.enum(["single", "multi"]).optional(),
  maxSimultaneous: z
    .number()
    .min(1, "Minimal 1 sesi")
    .max(10, "Maksimal 10 sesi simultan")
    .optional(),
  allowedNasIps: z.array(z.string()).optional(),
  status: z.enum(["active", "suspended", "disabled"]),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerFormProps {
  initialData?: Customer;
  profiles: PppProfile[];
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
  const [showPppoePassword, setShowPppoePassword] = useState(false);
  const [showPortalPassword, setShowPortalPassword] = useState(false);

  const createCustomerMutation = useCreateCustomerMutation();
  const updateCustomerMutation = useUpdateCustomerMutation();

  const submitting =
    createCustomerMutation.isPending || updateCustomerMutation.isPending;

  // Fallback awal allowedNasIps: jika ada initialData.allowedNasIps pakai itu, jika tidak coba ambil IP router dari nasId
  const fallbackNasIp = initialData?.nasId
    ? routers.find((r) => r.id === initialData.nasId)?.ipAddress
    : undefined;
  const initialAllowedIps =
    initialData?.allowedNasIps && initialData.allowedNasIps.length > 0
      ? initialData.allowedNasIps
      : fallbackNasIp
        ? [fallbackNasIp]
        : [];

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
      portalPassword: isEditing ? "" : generatePppoePassword(8),
      fullName: initialData?.fullName || "",
      phone: initialData?.phone || "",
      address: initialData?.address || "",
      profileId: initialData?.profileId || profiles[0]?.id || "",
      staticIp: initialData?.staticIp || "",
      nasId: initialData?.nasId || routers[0]?.id || "",
      bindOnNas: initialData?.bindOnNas ?? false,
      sessionMode: initialData?.sessionMode || "single",
      maxSimultaneous: initialData?.maxSimultaneous || 1,
      allowedNasIps: initialAllowedIps,
      status: initialData?.status || "active",
    },
  });

  const selectedProfileId = watch("profileId");
  const selectedStatus = watch("status");
  const bindOnNas = watch("bindOnNas");
  const sessionMode = watch("sessionMode");
  const maxSimultaneous = watch("maxSimultaneous");
  const allowedNasIps = watch("allowedNasIps") || [];

  const handleRandomizePppoePassword = () => {
    setValue("password", generatePppoePassword(8), { shouldValidate: true });
  };

  const handleRandomizePortalPassword = () => {
    setValue("portalPassword", generatePppoePassword(8), {
      shouldValidate: true,
    });
  };

  const handleToggleNasIp = (ip: string) => {
    const current = allowedNasIps;
    if (current.includes(ip)) {
      setValue(
        "allowedNasIps",
        current.filter((item) => item !== ip),
        { shouldValidate: true },
      );
    } else {
      setValue("allowedNasIps", [...current, ip], { shouldValidate: true });
    }
  };

  const handleSelectAllRouters = () => {
    const allIps = routers.map((r) => r.ipAddress).filter(Boolean);
    setValue("allowedNasIps", allIps, { shouldValidate: true });
  };

  const handleClearAllRouters = () => {
    setValue("allowedNasIps", [], { shouldValidate: true });
  };

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      const cleanEmail = data.email?.trim() || undefined;
      const cleanPortalPassword = data.portalPassword?.trim() || undefined;

      if (isEditing && initialData) {
        await updateCustomerMutation.mutateAsync({
          id: initialData.id,
          updates: {
            ...(data.password?.trim()
              ? { password: data.password.trim() }
              : {}),
            email: cleanEmail,
            portalPassword: cleanPortalPassword,
            fullName: data.fullName?.trim() || undefined,
            phone: data.phone?.trim() || undefined,
            address: data.address?.trim() || undefined,
            profileId: data.profileId,
            staticIp: data.staticIp?.trim() || undefined,
            nasId: data.nasId || undefined,
            bindOnNas: data.bindOnNas,
            sessionMode: data.sessionMode,
            maxSimultaneous: Number(data.maxSimultaneous) || 1,
            allowedNasIps: data.bindOnNas ? data.allowedNasIps : [],
            status: data.status as CustomerStatus,
          },
        });
        toast.success(
          `Data pelanggan ${initialData.username} berhasil diperbarui.`,
        );
        router.push(`/customers/${initialData.id}`);
      } else {
        const created = await createCustomerMutation.mutateAsync({
          email: cleanEmail,
          portalPassword: cleanPortalPassword,
          fullName: data.fullName?.trim() || undefined,
          phone: data.phone?.trim() || undefined,
          address: data.address?.trim() || undefined,
          profileId: data.profileId,
          staticIp: data.staticIp?.trim() || undefined,
          nasId: data.nasId || undefined,
          bindOnNas: data.bindOnNas,
          sessionMode: data.sessionMode,
          maxSimultaneous: Number(data.maxSimultaneous) || 1,
          allowedNasIps: data.bindOnNas ? data.allowedNasIps : [],
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
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="gap-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
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
        <div className="flex items-center gap-2">
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
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Section 1: PPPoE Credentials & Plan */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Shield className="h-5 w-5" />
              <CardTitle className="text-base">
                Kredensial & Paket Layanan
              </CardTitle>
            </div>
            <CardDescription>
              {isEditing
                ? "Informasi akun PPPoE dan paket profil bandwidth pelanggan."
                : "Username PPPoE dan Password akun akan otomatis dibuatkan oleh sistem secara unik."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tampilan Username & Password saat Edit */}
            {isEditing && initialData ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="username">
                    Username PPPoE / ID Pelanggan
                  </Label>
                  <Input
                    id="username"
                    value={initialData.username}
                    readOnly
                    disabled
                    className="bg-slate-100 font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  />
                  <p className="text-[11px] text-slate-500">
                    Username PPPoE bertindak sebagai Identifier unik pelanggan
                    dan tidak dapat diubah sembarangan.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Reset Password PPPoE</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPppoePassword(!showPppoePassword)}
                        className="h-6 px-1.5 text-xs text-slate-500"
                      >
                        {showPppoePassword ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRandomizePppoePassword}
                        className="h-6 px-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Acak Password
                      </Button>
                    </div>
                  </div>
                  <Input
                    id="password"
                    type={showPppoePassword ? "text" : "password"}
                    placeholder="Kosongkan jika tidak ingin mengubah password dial-in"
                    {...register("password")}
                    className={
                      errors.password
                        ? "border-rose-500 font-mono"
                        : "font-mono"
                    }
                  />
                  {errors.password && (
                    <p className="text-xs text-rose-500">
                      {errors.password.message}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3.5 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold">
                  <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>Auto-Generated PPPoE ID & Password</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Sistem akan otomatis meng-generate Username unik format{" "}
                  <code>cust_YYYYMMDDxxxx</code> dan Password 8-karakter acak
                  saat pelanggan ini disimpan.
                </p>
              </div>
            )}

            {/* Profil Paket Layanan (PPP Profile) */}
            <div className="space-y-2">
              <Label htmlFor="profileId">
                Paket Layanan (PPP Profile){" "}
                <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={selectedProfileId}
                onValueChange={(val) =>
                  setValue("profileId", val, { shouldValidate: true })
                }
              >
                <SelectTrigger id="profileId">
                  <SelectValue placeholder="Pilih Paket Layanan (PPP Profile)" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => {
                    const bw = p.bandwidth;
                    const speedStr = bw
                      ? `(↓${bw.maxDownload} ${bw.maxDownloadUnit} / ↑${bw.maxUpload} ${bw.maxUploadUnit})`
                      : "";
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} {speedStr} — Rp{" "}
                        {p.price?.toLocaleString("id-ID")}/bln
                      </SelectItem>
                    );
                  })}
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

        {/* Section 2: Session Control (Simultaneous-Use) */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400">
              <Layers className="h-5 w-5" />
              <CardTitle className="text-base">
                Kontrol Sesi PPPoE (Simultaneous-Use)
              </CardTitle>
            </div>
            <CardDescription>
              Atur jumlah perangkat/koneksi dial-in yang dapat login bersamaan
              via FreeRADIUS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Mode Sesi PPPoE</Label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex cursor-pointer flex-col rounded-lg border p-3 transition-all ${
                    sessionMode === "single"
                      ? "border-violet-600 bg-violet-50/50 dark:border-violet-500 dark:bg-violet-950/30"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">
                      Single Session
                    </span>
                    <input
                      type="radio"
                      name="sessionMode"
                      value="single"
                      checked={sessionMode === "single"}
                      onChange={() =>
                        setValue("sessionMode", "single", {
                          shouldValidate: true,
                        })
                      }
                      className="h-4 w-4 accent-violet-600"
                    />
                  </div>
                  <span className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-tight">
                    1 Perangkat / 1 Sesi Aktif (Default)
                  </span>
                </label>

                <label
                  className={`flex cursor-pointer flex-col rounded-lg border p-3 transition-all ${
                    sessionMode === "multi"
                      ? "border-violet-600 bg-violet-50/50 dark:border-violet-500 dark:bg-violet-950/30"
                      : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Multi Session</span>
                    <input
                      type="radio"
                      name="sessionMode"
                      value="multi"
                      checked={sessionMode === "multi"}
                      onChange={() =>
                        setValue("sessionMode", "multi", {
                          shouldValidate: true,
                        })
                      }
                      className="h-4 w-4 accent-violet-600"
                    />
                  </div>
                  <span className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-tight">
                    Banyak Sesi Simultan
                  </span>
                </label>
              </div>
            </div>

            {sessionMode === "multi" && (
              <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-3.5 dark:border-violet-900/40 dark:bg-violet-950/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="maxSimultaneous"
                    className="text-sm font-medium"
                  >
                    Maksimal Sesi Simultan
                  </Label>
                  <Badge variant="secondary" className="font-mono text-xs">
                    Simultaneous-Use := {maxSimultaneous || 2}
                  </Badge>
                </div>
                <Input
                  id="maxSimultaneous"
                  type="number"
                  min={1}
                  max={10}
                  {...register("maxSimultaneous", { valueAsNumber: true })}
                  className="bg-white dark:bg-slate-900"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Pelanggan diizinkan online maksimal {maxSimultaneous || 2}{" "}
                  sesi secara bersamaan. Sesi ke-
                  {(Number(maxSimultaneous) || 2) + 1} akan otomatis ditolak
                  FreeRADIUS.
                </p>
                {errors.maxSimultaneous && (
                  <p className="text-xs text-rose-500">
                    {errors.maxSimultaneous.message}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Network & MikroTik NAS Whitelist */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Network className="h-5 w-5" />
              <CardTitle className="text-base">
                Pengaturan Jaringan & Whitelist Router NAS
              </CardTitle>
            </div>
            <CardDescription>
              Konfigurasi IP Statis (<code>Framed-IP-Address</code>) dan batasan
              router NAS MikroTik yang diizinkan untuk dial-in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
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
                <Label htmlFor="nasId">Default Router NAS Acuan</Label>
                <Select
                  value={watch("nasId")}
                  onValueChange={(val) =>
                    setValue("nasId", val, { shouldValidate: true })
                  }
                >
                  <SelectTrigger id="nasId">
                    <SelectValue placeholder="Pilih NAS Router Acuan" />
                  </SelectTrigger>
                  <SelectContent>
                    {routers.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.ipAddress})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500">
                  Router utama untuk referensi pemutusan sesi / routing awal.
                </p>
              </div>
            </div>

            {/* Bind on NAS & Whitelist */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bindOnNas}
                  onChange={(e) =>
                    setValue("bindOnNas", e.target.checked, {
                      shouldValidate: true,
                    })
                  }
                  className="mt-1 h-4 w-4 accent-indigo-600 rounded"
                />
                <div className="space-y-0.5">
                  <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Kunci Login ke Router NAS Tertentu (Bind on NAS Whitelist)
                    {bindOnNas && (
                      <Badge
                        variant="outline"
                        className="text-indigo-600 border-indigo-300"
                      >
                        {allowedNasIps.length} Router Diizinkan
                      </Badge>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Jika diaktifkan, pelanggan hanya dapat dial PPPoE melalui
                    router yang dipilih di bawah ini. Login dari router lain
                    akan otomatis ditolak dengan pesan{" "}
                    <i>"Login tidak diizinkan dari router ini"</i>.
                  </span>
                </div>
              </label>

              {bindOnNas ? (
                <div className="pt-2 space-y-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Pilih Router NAS yang Diizinkan:
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAllRouters}
                        className="h-6 text-xs px-2 text-indigo-600 hover:text-indigo-700"
                      >
                        Pilih Semua
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearAllRouters}
                        className="h-6 text-xs px-2 text-slate-500 hover:text-slate-700"
                      >
                        Batal Semua
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                    {routers.map((r) => {
                      const isChecked = allowedNasIps.includes(r.ipAddress);
                      return (
                        <label
                          key={r.id}
                          className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-xs cursor-pointer transition-all ${
                            isChecked
                              ? "border-indigo-600 bg-indigo-50/50 dark:border-indigo-500 dark:bg-indigo-950/30"
                              : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleNasIp(r.ipAddress)}
                            className="h-3.5 w-3.5 accent-indigo-600 rounded"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold truncate text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                              <RouterIcon className="h-3.5 w-3.5 text-slate-500" />
                              {r.name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 truncate">
                              {r.ipAddress}
                            </div>
                          </div>
                          <span
                            className={`h-2 w-2 rounded-full shrink-0 ${
                              r.status === "online"
                                ? "bg-emerald-500"
                                : "bg-slate-300"
                            }`}
                          />
                        </label>
                      );
                    })}
                  </div>
                  {allowedNasIps.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      * Perhatian: Bind on NAS diaktifkan namun belum ada router
                      yang dipilih. Pelanggan tidak akan bisa login sampai
                      router diizinkan.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 pt-1 italic">
                  * Bind on NAS nonaktif: Pelanggan bebas melakukan koneksi
                  PPPoE dari seluruh router NAS yang terdaftar di sistem.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Customer Metadata & Portal Account */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <User className="h-5 w-5" />
              <CardTitle className="text-base">
                Identitas Pelanggan & Akun Portal Self-Care
              </CardTitle>
            </div>
            <CardDescription>
              Data pelanggan dan akses login ke Portal Pelanggan Self-Care (
              <code className="text-xs">/portal</code>).
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

            {/* Akun portal self-care */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50 space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Akun Portal Pelanggan (Customer Self-Care)</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pelanggan dapat login ke web <code>/portal</code> menggunakan
                Username PPPoE atau Email terdaftar untuk melihat tagihan,
                riwayat pemakaian, dan status jaringan secara mandiri.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Pelanggan (Opsional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="mis. budi@gmail.com (opsional)"
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
                    <Label htmlFor="portalPassword">
                      {isEditing
                        ? "Reset Password Portal"
                        : "Password Portal (Opsional)"}
                    </Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setShowPortalPassword(!showPortalPassword)
                        }
                        className="h-6 px-1.5 text-xs text-slate-500"
                      >
                        {showPortalPassword ? (
                          <EyeOff className="h-3 w-3" />
                        ) : (
                          <Eye className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRandomizePortalPassword}
                        className="h-6 px-1.5 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Acak Password
                      </Button>
                    </div>
                  </div>
                  <Input
                    id="portalPassword"
                    type={showPortalPassword ? "text" : "password"}
                    placeholder={
                      isEditing
                        ? "Kosongkan jika tidak ingin mengubah password portal"
                        : "Default: password123 (atau acak)"
                    }
                    {...register("portalPassword")}
                    className={
                      errors.portalPassword
                        ? "border-rose-500 font-mono"
                        : "font-mono"
                    }
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
