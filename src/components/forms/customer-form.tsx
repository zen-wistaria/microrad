"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CheckCircle,
  CircleAlert,
  CircleX,
  Loader2,
  Network,
  Shield,
  User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

  const selectedProfileId = watch("profileId");
  const selectedStatus = watch("status");
  const selectedNasId = watch("nasId");
  const bindOnNas = watch("bindOnNas");

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      setSubmitting(true);
      if (isEditing && initialData) {
        await updateCustomer(initialData.id, {
          username: data.username,
          ...(data.password ? { password: data.password } : {}),
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
        if (!data.password || data.password.length < 6) {
          toast.error("Password PPPoE wajib diisi minimal 6 karakter.");
          setSubmitting(false);
          return;
        }
        const created = await createCustomer({
          username: data.username,
          password: data.password,
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
              Informasi autentikasi PPPoE yang akan disinkronkan ke FreeRADIUS (
              <code className="text-xs">radcheck</code>).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">
                Username PPPoE <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="username"
                placeholder="mis. budi_santoso"
                {...register("username")}
                className={errors.username ? "border-rose-500" : ""}
              />
              {errors.username && (
                <p className="text-xs text-rose-500">
                  {errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                Password PPPoE{" "}
                {!isEditing && <span className="text-rose-500">*</span>}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={
                  isEditing
                    ? "Kosongkan jika tidak ingin mengubah password"
                    : "Minimal 6 karakter"
                }
                {...register("password")}
                className={errors.password ? "border-rose-500" : ""}
              />
              {errors.password && (
                <p className="text-xs text-rose-500">
                  {errors.password.message}
                </p>
              )}
            </div>

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

            <div className="space-y-2">
              <Label htmlFor="status">Status Akun Pelanggan</Label>
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

        {/* Section 3: Customer Metadata (Bio & Contact) */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <User className="h-5 w-5" />
              <CardTitle className="text-base">
                Informasi Pelanggan & Kontak
              </CardTitle>
            </div>
            <CardDescription>
              Data informasi identitas pelanggan untuk keperluan administrasi
              dan teknisi lapangan.
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
