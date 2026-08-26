"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CheckCircle,
  CircleAlert,
  CircleX,
  Eye,
  EyeOff,
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
  useProfileGroupsQuery,
  useUpdateCustomerMutation,
} from "@/lib/api/hooks";
import { generatePppoePassword } from "@/lib/generators";
import type {
  Customer,
  CustomerStatus,
  InternetProfile,
  ProfileGroup,
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
      (val) => !val || z.string().email().safeParse(val).success,
      "Format email tidak valid",
    ),
  portalPassword: z.string().optional(),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  profileId: z.string().min(1, "Wajib memilih Paket Internet"),
  profileGroupId: z.string().min(1, "Wajib memilih Profile Group (Wilayah)"),
  staticIp: z
    .string()
    .optional()
    .refine(
      (val) => !val || ipv4Regex.test(val.trim()),
      "Format IP Statis (IPv4) tidak valid",
    ),
  nasId: z.string().optional(),
  bindOnNas: z.boolean(),
  sessionMode: z.enum(["single", "multi"]),
  maxSimultaneous: z.number().int().min(1).max(10),
  allowedNasIps: z.array(z.string()),
  status: z.enum(["active", "suspended", "disabled"]),
});

export type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerFormProps {
  initialData?: Customer;
  profiles: InternetProfile[];
  profileGroups?: ProfileGroup[];
  isEditing?: boolean;
}

export function CustomerForm({
  initialData,
  profiles,
  profileGroups: initialGroups,
  isEditing = false,
}: CustomerFormProps) {
  const router = useRouter();
  const [showPppoePassword, setShowPppoePassword] = useState(false);
  const [showPortalPassword, setShowPortalPassword] = useState(false);

  const { data: groupsRes } = useProfileGroupsQuery({ limit: 1000 });
  const groups = initialGroups || groupsRes?.data || [];

  const createCustomerMutation = useCreateCustomerMutation();
  const updateCustomerMutation = useUpdateCustomerMutation();

  const submitting =
    createCustomerMutation.isPending || updateCustomerMutation.isPending;

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
      profileGroupId: initialData?.profileGroupId || groups[0]?.id || "",
      staticIp: initialData?.staticIp || "",
      nasId: initialData?.nasId || "",
      bindOnNas: false,
      sessionMode: initialData?.sessionMode || "single",
      maxSimultaneous: initialData?.maxSimultaneous || 1,
      allowedNasIps: [],
      status: initialData?.status || "active",
    },
  });

  const selectedProfileId = watch("profileId");
  const selectedGroupId = watch("profileGroupId");
  const selectedStatus = watch("status");
  const sessionMode = watch("sessionMode");
  const maxSimultaneous = watch("maxSimultaneous");

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const _groupNodes = selectedGroup?.pppProfiles || [];
  const groupRouters = selectedGroup?.routers || [];

  const handleRandomizePppoePassword = () => {
    setValue("password", generatePppoePassword(8), { shouldValidate: true });
  };

  const handleRandomizePortalPassword = () => {
    setValue("portalPassword", generatePppoePassword(8), {
      shouldValidate: true,
    });
  };

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      const cleanEmail = data.email?.trim() || null;
      const cleanPortalPassword = data.portalPassword?.trim() || undefined;
      const groupFirstNasId = selectedGroup?.routers?.[0]?.id;

      if (isEditing && initialData) {
        await updateCustomerMutation.mutateAsync({
          id: initialData.id,
          updates: {
            ...(data.password?.trim()
              ? { password: data.password.trim() }
              : {}),
            email: cleanEmail,
            portalPassword: cleanPortalPassword,
            fullName: data.fullName?.trim() || null,
            phone: data.phone?.trim() || null,
            address: data.address?.trim() || null,
            profileId: data.profileId,
            profileGroupId: data.profileGroupId || null,
            staticIp: data.staticIp?.trim() || null,
            nasId: groupFirstNasId || data.nasId || null,
            bindOnNas: false,
            sessionMode: data.sessionMode,
            maxSimultaneous: Number(data.maxSimultaneous) || 1,
            allowedNasIps: [],
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
          fullName: data.fullName?.trim() || null,
          phone: data.phone?.trim() || null,
          address: data.address?.trim() || null,
          profileId: data.profileId,
          profileGroupId: data.profileGroupId || null,
          staticIp: data.staticIp?.trim() || null,
          nasId: groupFirstNasId || data.nasId || null,
          bindOnNas: false,
          sessionMode: data.sessionMode,
          maxSimultaneous: Number(data.maxSimultaneous) || 1,
          allowedNasIps: [],
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
                ? "Informasi akun PPPoE, paket bandwidth, dan lokasi node/grup pelanggan."
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

            {/* Paket Internet */}
            <div className="space-y-2">
              <Label htmlFor="profileId">
                Paket Internet <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={selectedProfileId}
                onValueChange={(val) =>
                  setValue("profileId", val, { shouldValidate: true })
                }
              >
                <SelectTrigger id="profileId">
                  <SelectValue placeholder="Pilih Paket Internet" />
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
              {selectedProfile?.bandwidth && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                  ✓ Kecepatan: ↓{selectedProfile.bandwidth.maxDownload}{" "}
                  {selectedProfile.bandwidth.maxDownloadUnit} / ↑
                  {selectedProfile.bandwidth.maxUpload}{" "}
                  {selectedProfile.bandwidth.maxUploadUnit} | Tarif: Rp{" "}
                  {selectedProfile.price?.toLocaleString("id-ID")}/bln
                </p>
              )}
              {errors.profileId && (
                <p className="text-xs text-rose-500">
                  {errors.profileId.message}
                </p>
              )}
            </div>

            {/* Profile Group (Wilayah / Failover Group) */}
            <div className="space-y-2">
              <Label htmlFor="profileGroupId">
                Wilayah (Profile Group) <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={selectedGroupId}
                onValueChange={(val) =>
                  setValue("profileGroupId", val, { shouldValidate: true })
                }
              >
                <SelectTrigger id="profileGroupId">
                  <SelectValue placeholder="Pilih Wilayah (Profile Group)" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} ({g.pppProfiles?.length || 0} Router Node)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.profileGroupId && (
                <p className="text-xs text-rose-500">
                  {errors.profileGroupId.message}
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

        {/* Section 3: Network Settings */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
              <Network className="h-5 w-5" />
              <CardTitle className="text-base">
                Pengaturan Jaringan & Router Wilayah
              </CardTitle>
            </div>
            <CardDescription>
              Konfigurasi IP Statis (<code>Framed-IP-Address</code>) dan
              informasi router node wilayah layanan.
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
                  Jika diisi, router MikroTik akan selalu memberikan IP statis
                  ini ke pelanggan.
                </p>
                {errors.staticIp && (
                  <p className="text-xs text-rose-500">
                    {errors.staticIp.message}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-900/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Router Node di {selectedGroup?.name || "Wilayah"}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono text-indigo-600"
                  >
                    {groupRouters.length} Router NAS
                  </Badge>
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <RouterIcon className="h-4 w-4 text-indigo-600" />
                  {groupRouters.length > 0
                    ? groupRouters.map((r) => r.name).join(", ")
                    : "Pilih Wilayah (Area Group) di atas"}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {groupRouters.length > 0
                    ? `Otomatis Terkunci & Failover: Pelanggan dial melalui ${groupRouters.length} router di wilayah ini.`
                    : "Pilih Wilayah (Area Group) di atas untuk menghubungkan router node."}
                </p>
              </div>
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
              Data kontak pelanggan dan akses login web portal mandiri
              pelanggan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nama Lengkap Pelanggan</Label>
                <Input
                  id="fullName"
                  placeholder="Contoh: Budi Santoso"
                  {...register("fullName")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Nomor Telepon / WhatsApp</Label>
                <Input
                  id="phone"
                  placeholder="Contoh: 08123456789"
                  {...register("phone")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Alamat Pemasangan</Label>
              <Input
                id="address"
                placeholder="Contoh: Jl. Merdeka No. 45, RT 01/RW 02"
                {...register("address")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="space-y-2">
                <Label htmlFor="email">Email Akun Portal Pelanggan</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Contoh: budi@gmail.com"
                  {...register("email")}
                  className={errors.email ? "border-rose-500" : ""}
                />
                <p className="text-[11px] text-slate-500">
                  Digunakan pelanggan untuk login ke Web Portal Pelanggan.
                </p>
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
                      : "Password Portal Pelanggan"}
                  </Label>
                  <div className="flex items-center gap-1">
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
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRandomizePortalPassword}
                      className="h-6 px-1.5 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Acak
                    </Button>
                  </div>
                </div>
                <Input
                  id="portalPassword"
                  type={showPortalPassword ? "text" : "password"}
                  placeholder={
                    isEditing
                      ? "Kosongkan jika tidak ingin mengubah password portal"
                      : "Password akun portal"
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
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
