"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Package, Sliders, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
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
import {
  useBandwidthsQuery,
  useCreatePppProfileMutation,
  useUpdatePppProfileMutation,
} from "@/lib/api/hooks";
import { formatBandwidthRateLimit } from "@/lib/radius-format";
import type { PppProfile } from "@/lib/types";
import { formatRupiah, getErrorMessage } from "@/lib/utils";

const pppProfileSchema = z.object({
  name: z.string().min(3, "Nama PPP Profile minimal 3 karakter"),
  price: z.number().min(0, "Harga paket minimal Rp 0"),
  bandwidthId: z.string().min(1, "Wajib memilih Konfigurasi Bandwidth"),
  priority: z.number().int().min(1).max(8),
});

type PppProfileFormValues = z.infer<typeof pppProfileSchema>;

interface PppProfileFormProps {
  initialData?: PppProfile;
  isEditing?: boolean;
}

const PRIORITY_OPTIONS = [
  { value: 1, label: "Priority 1 - Tertinggi (VIP / Urgent)" },
  { value: 2, label: "Priority 2 - Sangat Tinggi" },
  { value: 3, label: "Priority 3 - Tinggi" },
  { value: 4, label: "Priority 4 - Di Atas Normal" },
  { value: 5, label: "Priority 5 - Normal" },
  { value: 6, label: "Priority 6 - Di Bawah Normal" },
  { value: 7, label: "Priority 7 - Rendah" },
  { value: 8, label: "Priority 8 - Terendah (Default)" },
];

export function PppProfileForm({
  initialData,
  isEditing = false,
}: PppProfileFormProps) {
  const router = useRouter();
  const { data: bwsRes } = useBandwidthsQuery();
  const bandwidths = bwsRes?.data || [];

  const createMutation = useCreatePppProfileMutation();
  const updateMutation = useUpdatePppProfileMutation();

  const submitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PppProfileFormValues>({
    resolver: zodResolver(pppProfileSchema),
    defaultValues: {
      name: initialData?.name || "",
      price: initialData?.price ?? 100000,
      bandwidthId: initialData?.bandwidthId || "",
      priority: initialData?.priority || 8,
    },
  });

  const watchedValues = watch();

  const selectedBandwidth = useMemo(
    () => bandwidths.find((b) => b.id === watchedValues.bandwidthId),
    [bandwidths, watchedValues.bandwidthId],
  );

  const rateLimitPreview = useMemo(() => {
    if (!selectedBandwidth) return "-";
    return formatBandwidthRateLimit(selectedBandwidth, watchedValues.priority);
  }, [selectedBandwidth, watchedValues.priority]);

  const onSubmit = async (values: PppProfileFormValues) => {
    try {
      if (isEditing && initialData) {
        await updateMutation.mutateAsync({
          id: initialData.id,
          data: values,
        });
        toast.success("PPP Profile berhasil diperbarui");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("PPP Profile berhasil dibuat");
      }
      router.push("/ppp-profiles");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-9 w-9">
            <Link href="/ppp-profiles">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isEditing ? "Edit PPP Profile" : "Tambah PPP Profile Baru"}
            </h1>
            <p className="text-xs text-slate-500">
              Paket layanan PPPoE global yang menentukan Bandwidth, Harga
              Tagihan, dan Priority.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/ppp-profiles">Batal</Link>
          </Button>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Simpan Perubahan" : "Buat PPP Profile"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Card 1: Informasi Paket & Harga */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-base">
                  Informasi Paket Layanan
                </CardTitle>
              </div>
              <CardDescription>
                Nama paket dan tarif bulanan langganan untuk invoice billing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nama PPP Profile</Label>
                <Input
                  id="name"
                  placeholder="Contoh: Paket 2 Mbps / Paket Home 10 Mbps / Gamer Ultra 50M"
                  {...register("name")}
                  className="mt-1"
                />
                {errors.name && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="price">Harga Paket (IDR / Bulan)</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-semibold">
                    Rp
                  </span>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    step={1000}
                    className="pl-9 font-semibold"
                    {...register("price", { valueAsNumber: true })}
                  />
                </div>
                {errors.price && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.price.message}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  Tarif bulanan langganan untuk pembuatan invoice billing
                  otomatis.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Relasi Bandwidth & Priority */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-violet-600" />
                <CardTitle className="text-base">
                  Konfigurasi Kecepatan & QoS
                </CardTitle>
              </div>
              <CardDescription>
                Pilih konfigurasi bandwidth MIR/CIR & antrian priority
                FreeRADIUS.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="bandwidthId">Konfigurasi Bandwidth</Label>
                <Select
                  value={watchedValues.bandwidthId}
                  onValueChange={(v) =>
                    setValue("bandwidthId", v, { shouldValidate: true })
                  }
                >
                  <SelectTrigger id="bandwidthId" className="mt-1">
                    <SelectValue placeholder="Pilih Konfigurasi Bandwidth..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bandwidths.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} (↓{b.maxDownload} {b.maxDownloadUnit} / ↑
                        {b.maxUpload} {b.maxUploadUnit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.bandwidthId && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.bandwidthId.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="priority">Queue Priority (1 - 8)</Label>
                <Select
                  value={String(watchedValues.priority || 8)}
                  onValueChange={(v) =>
                    setValue("priority", Number(v), { shouldValidate: true })
                  }
                >
                  <SelectTrigger id="priority" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={String(p.value)}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Prioritas antrian bandwidth RouterOS. Nilai 1 memiliki
                  prioritas tertinggi saat congestion.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Summary */}
        <div>
          <Card className="sticky top-6 border-blue-100 bg-blue-50/40 dark:border-blue-900/30 dark:bg-blue-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-base">
                  Ringkasan PPP Profile
                </CardTitle>
              </div>
              <CardDescription>
                Snapshot data yang akan diterapkan ke pelanggan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="space-y-2 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between border-b border-blue-200/50 pb-2 dark:border-blue-800/50">
                  <span>Harga Paket:</span>
                  <span className="font-semibold text-blue-700 dark:text-blue-300">
                    {formatRupiah(watchedValues.price || 0)} / bln
                  </span>
                </div>
                <div className="flex justify-between border-b border-blue-200/50 pb-2 dark:border-blue-800/50">
                  <span>Kecepatan:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedBandwidth
                      ? `↓${selectedBandwidth.maxDownload} ${selectedBandwidth.maxDownloadUnit} / ↑${selectedBandwidth.maxUpload} ${selectedBandwidth.maxUploadUnit}`
                      : "-"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 border-b border-blue-200/50 pb-2 dark:border-blue-800/50">
                  <span>Rate-Limit MikroTik:</span>
                  <span className="rounded bg-white p-2 font-mono text-[11px] text-blue-950 shadow-2xs dark:bg-slate-900 dark:text-blue-200 break-all">
                    {rateLimitPreview}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Priority Queue:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    Priority {watchedValues.priority || 8}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
