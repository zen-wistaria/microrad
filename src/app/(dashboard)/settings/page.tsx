"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Building2,
  CheckCircle2,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Receipt,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { getCompanyProfile, updateCompanyProfile } from "@/lib/api/settings";
import type { CompanyProfile } from "@/lib/types";
import { formatDate } from "@/lib/utils";

const companyProfileSchema = z.object({
  brandName: z.string().min(2, "Nama brand minimal 2 karakter"),
  fullName: z.string().min(2, "Nama panjang perusahaan minimal 2 karakter"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .union([z.literal(""), z.string().email("Format email tidak valid")])
    .optional(),
  website: z.string().optional(),
  npwp: z.string().optional(),
  licenseNo: z.string().optional(),
});

type CompanyProfileFormValues = z.infer<typeof companyProfileSchema>;

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CompanyProfileFormValues>({
    resolver: zodResolver(companyProfileSchema),
    defaultValues: {
      brandName: "",
      fullName: "",
      address: "",
      phone: "",
      email: "",
      website: "",
      npwp: "",
      licenseNo: "",
    },
  });

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await getCompanyProfile();
      setProfile(data);
      reset(data);
    } catch (_e) {
      toast.error("Gagal memuat profil perusahaan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const onSubmit = async (data: CompanyProfileFormValues) => {
    try {
      setSubmitting(true);
      const updated = await updateCompanyProfile(data);
      setProfile(updated);
      toast.success("Profil perusahaan berhasil diperbarui.");
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan profil perusahaan.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Profil Perusahaan
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Konfigurasi identitas perusahaan yang ditampilkan pada faktur
            (invoice) yang dicetak dari menu pelanggan.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchProfile}
            className="gap-1.5 text-xs text-slate-600 dark:text-slate-400"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {profile?.updatedAt && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Terakhir diperbarui: {formatDate(profile.updatedAt)}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Identitas Perusahaan */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Building2 className="h-5 w-5" />
              <CardTitle className="text-base">Identitas Perusahaan</CardTitle>
            </div>
            <CardDescription>
              Nama ini akan ditampilkan pada header invoice / nota pembayaran
              pelanggan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brandName">
                  Nama Brand <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="brandName"
                  placeholder="mis. MicroRAD Internet Services"
                  {...register("brandName")}
                  className={errors.brandName ? "border-rose-500" : ""}
                />
                {errors.brandName && (
                  <p className="text-xs text-rose-500">
                    {errors.brandName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">
                  Nama Panjang Perusahaan{" "}
                  <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  placeholder="mis. PT MicroRAD Broadband Solusindo"
                  {...register("fullName")}
                  className={errors.fullName ? "border-rose-500" : ""}
                />
                {errors.fullName && (
                  <p className="text-xs text-rose-500">
                    {errors.fullName.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Alamat Kantor</Label>
              <Input
                id="address"
                placeholder="mis. Jl. Jenderal Sudirman No. 45, Jakarta 10220"
                {...register("address")}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Telepon / WhatsApp</Label>
                <Input
                  id="phone"
                  placeholder="mis. 0812-8888-9999"
                  {...register("phone")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="mis. billing@microrad.net"
                  {...register("email")}
                  className={errors.email ? "border-rose-500" : ""}
                />
                {errors.email && (
                  <p className="text-xs text-rose-500">
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  placeholder="mis. www.microrad.net"
                  {...register("website")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npwp">NPWP</Label>
                <Input
                  id="npwp"
                  placeholder="mis. 01.345.678.9-012.000"
                  {...register("npwp")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="licenseNo">
                  No. Izin ISP / Penyelenggaraan
                </Label>
                <Input
                  id="licenseNo"
                  placeholder="mis. 124/DIR-POSTEL/2023"
                  {...register("licenseNo")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
              <Receipt className="h-5 w-5" />
              <CardTitle className="text-base">
                Pratinjau Header Invoice
              </CardTitle>
            </div>
            <CardDescription>
              Tampilan identitas perusahaan pada faktur cetak (print) pelanggan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2.5 border-b border-slate-200 pb-4 dark:border-slate-800">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-base font-black text-white">
                  {(profile?.brandName || "M").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-extrabold leading-tight tracking-tight text-foreground">
                    {profile?.brandName || "-"}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                    {profile?.fullName || "-"}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-[11px] leading-tight text-slate-500">
                {profile?.address && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                    {profile.address}
                  </p>
                )}
                {profile?.phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                    {profile.phone}
                  </p>
                )}
                {profile?.email && (
                  <p className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                    {profile.email}
                  </p>
                )}
                {profile?.website && (
                  <p className="flex items-center gap-1.5">
                    <Globe className="h-3 w-3 shrink-0 text-slate-400" />
                    {profile.website}
                  </p>
                )}
                {profile?.npwp && (
                  <p className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3 shrink-0 text-slate-400" />
                    NPWP: {profile.npwp}
                  </p>
                )}
                {profile?.licenseNo && (
                  <p className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3 shrink-0 text-slate-400" />
                    Izin: {profile.licenseNo}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset(profile ?? undefined)}
            disabled={submitting}
          >
            Batal
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Simpan Pengaturan
          </Button>
        </div>
      </form>
    </div>
  );
}
