"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, Loader2, Package, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  useCreateInternetProfileMutation,
  useUpdateInternetProfileMutation,
} from "@/lib/api/hooks";
import { formatBandwidthRateLimit } from "@/lib/radius-format";
import type { InternetProfile } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

const internetProfileSchema = z.object({
  name: z.string().min(3, "Nama paket minimal 3 karakter"),
  price: z.number().min(0, "Harga minimal Rp 0"),
  bandwidthId: z.string().min(1, "Wajib memilih konfigurasi bandwidth"),
  priority: z.number().int().min(1).max(8),
});

type InternetProfileFormValues = z.infer<typeof internetProfileSchema>;

interface InternetProfileFormProps {
  initialData?: InternetProfile;
  isEdit?: boolean;
}

export function InternetProfileForm({
  initialData,
  isEdit,
}: InternetProfileFormProps) {
  const router = useRouter();
  const createMutation = useCreateInternetProfileMutation();
  const updateMutation = useUpdateInternetProfileMutation();

  const { data: bwRes, isLoading: loadingBw } = useBandwidthsQuery();
  const bandwidths = bwRes?.data || [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<InternetProfileFormValues>({
    resolver: zodResolver(internetProfileSchema),
    defaultValues: {
      name: initialData?.name || "",
      price: initialData?.price || 100000,
      bandwidthId: initialData?.bandwidthId || "",
      priority: initialData?.priority || 8,
    },
  });

  const selectedBwId = watch("bandwidthId");
  const selectedPriority = watch("priority");
  const selectedBw = bandwidths.find((b) => b.id === selectedBwId);

  const rateLimitPreview = selectedBw
    ? formatBandwidthRateLimit(selectedBw, selectedPriority)
    : "";

  const onSubmit = async (values: InternetProfileFormValues) => {
    try {
      if (isEdit && initialData) {
        await updateMutation.mutateAsync({
          id: initialData.id,
          data: values,
        });
        toast.success("Paket Internet berhasil diperbarui.");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Paket Internet baru berhasil ditambahkan.");
      }
      router.push("/internet-profiles");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isPending =
    isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/internet-profiles">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isEdit ? "Edit Paket Internet" : "Tambah Paket Internet"}
            </h1>
            <p className="text-xs text-slate-500">
              {isEdit
                ? "Perbarui tarif atau alokasi bandwidth paket langganan"
                : "Buat produk paket internet langganan baru"}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" />
            Informasi Paket
          </CardTitle>
          <CardDescription>
            Tentukan nama produk paket layanan dan tarif bulanan yang akan
            ditagihkan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Paket Internet *</Label>
            <Input
              id="name"
              placeholder="Contoh: Paket Hemat 5 Mbps, Home 10M, Gamer 50M"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-rose-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="price">Harga Berlangganan Bulanan (IDR) *</Label>
            <Input
              id="price"
              type="number"
              min={0}
              step={1000}
              placeholder="150000"
              {...register("price", { valueAsNumber: true })}
            />
            <p className="text-[11px] text-slate-400">
              Nominal yang otomatis dicantumkan saat pembuatan tagihan invoice
              pelanggan.
            </p>
            {errors.price && (
              <p className="text-xs text-rose-500">{errors.price.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" />
            Bandwidth & Antrean MikroTik (QoS)
          </CardTitle>
          <CardDescription>
            Pilih batas kecepatan upload/download dan prioritas queue antrean.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="bandwidthId">Konfigurasi Bandwidth *</Label>
              <Link
                href="/bandwidths"
                className="text-xs text-blue-600 hover:underline"
              >
                + Kelola Bandwidth
              </Link>
            </div>
            <Select
              value={selectedBwId}
              onValueChange={(val) =>
                setValue("bandwidthId", val, { shouldValidate: true })
              }
              disabled={loadingBw}
            >
              <SelectTrigger id="bandwidthId">
                <SelectValue placeholder="-- Pilih Konfigurasi Bandwidth --" />
              </SelectTrigger>
              <SelectContent>
                {bandwidths.map((bw) => (
                  <SelectItem key={bw.id} value={bw.id}>
                    {bw.name} (↓{bw.maxDownload} {bw.maxDownloadUnit} / ↑
                    {bw.maxUpload} {bw.maxUploadUnit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.bandwidthId && (
              <p className="text-xs text-rose-500">
                {errors.bandwidthId.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="priority">
              Priority Antrean RouterOS (Queue Priority) *
            </Label>
            <Select
              value={String(selectedPriority)}
              onValueChange={(val) =>
                setValue("priority", Number(val), { shouldValidate: true })
              }
            >
              <SelectTrigger id="priority">
                <SelectValue placeholder="Pilih Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Priority 1 (Tertinggi / VIP)</SelectItem>
                <SelectItem value="2">Priority 2 (Tinggi)</SelectItem>
                <SelectItem value="3">Priority 3</SelectItem>
                <SelectItem value="4">Priority 4 (Menengah Atas)</SelectItem>
                <SelectItem value="5">Priority 5</SelectItem>
                <SelectItem value="6">Priority 6 (Menengah Bawah)</SelectItem>
                <SelectItem value="7">Priority 7 (Rendah)</SelectItem>
                <SelectItem value="8">
                  Priority 8 (Default / Standar)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400">
              Angka 1 adalah prioritas tertinggi, angka 8 adalah prioritas
              standar MikroTik.
            </p>
            {errors.priority && (
              <p className="text-xs text-rose-500">{errors.priority.message}</p>
            )}
          </div>

          {rateLimitPreview && (
            <div className="p-3.5 rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20 text-xs space-y-1">
              <div className="font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                Mikrotik-Rate-Limit RADIUS Atribut:
              </div>
              <p className="font-mono text-blue-800 dark:text-blue-300 font-bold break-all">
                {rateLimitPreview}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" type="button" asChild>
          <Link href="/internet-profiles">Batal</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isEdit ? "Simpan Perubahan" : "Buat Paket Internet"}
        </Button>
      </div>
    </form>
  );
}
