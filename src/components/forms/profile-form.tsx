"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Loader2,
  Wallet,
  Zap,
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
import { createProfile, updateProfile } from "@/lib/api/profiles";
import type { BandwidthProfile } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

const profileSchema = z.object({
  name: z.string().min(3, "Nama profil minimal 3 karakter"),
  rateLimitDown: z.number().min(1, "Batas download minimal 1 Mbps"),
  rateLimitUp: z.number().min(1, "Batas upload minimal 1 Mbps"),
  // QoS lanjutan ala MikroTik (nilai kosong = null → tidak dipakai) — input
  // type=number menghasilkan string kosong; zod.coerce mengubahnya jadi 0,
  // padahal 0 ingin dianggap kosong. Karena itu kita jadikan nullable.
  burstLimitDown: z.number().min(1).optional(),
  burstLimitUp: z.number().min(1).optional(),
  burstThresholdDown: z.number().min(1).optional(),
  burstThresholdUp: z.number().min(1).optional(),
  burstTimeSeconds: z.number().int().min(1).max(600).optional(),
  priority: z.number().int().min(1).max(8).optional(),
  limitAtDown: z.number().min(1).optional(),
  limitAtUp: z.number().min(1).optional(),
  price: z.number().min(1, "Harga paket minimal Rp 1").max(1_000_000_000),
  description: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  initialData?: BandwidthProfile;
  isEditing?: boolean;
}

export function ProfileForm({
  initialData,
  isEditing = false,
}: ProfileFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initialData?.name || "",
      rateLimitDown: initialData?.rateLimitDown || 10,
      rateLimitUp: initialData?.rateLimitUp || 5,
      burstLimitDown: initialData?.burstLimitDown || undefined,
      burstLimitUp: initialData?.burstLimitUp || undefined,
      burstThresholdDown: initialData?.burstThresholdDown || undefined,
      burstThresholdUp: initialData?.burstThresholdUp || undefined,
      burstTimeSeconds: initialData?.burstTimeSeconds || undefined,
      priority: initialData?.priority || undefined,
      limitAtDown: initialData?.limitAtDown || undefined,
      limitAtUp: initialData?.limitAtUp || undefined,
      price: initialData?.price || 100000,
      description: initialData?.description || "",
    },
  });

  const rateLimitDown = watch("rateLimitDown");
  const rateLimitUp = watch("rateLimitUp");
  const burstLimitDown = watch("burstLimitDown");
  const burstLimitUp = watch("burstLimitUp");

  // Peringatan: burst tidak boleh < max (RouterOS tolak queue).
  // dibandingkan dalam kbps (max dalam Mbps → ×1000).
  const maxDownKbps = (rateLimitDown || 0) * 1000;
  const maxUpKbps = (rateLimitUp || 0) * 1000;
  const warnBurstDown = burstLimitDown != null && burstLimitDown < maxDownKbps;
  const warnBurstUp = burstLimitUp != null && burstLimitUp < maxUpKbps;

  const onSubmit = async (data: ProfileFormValues) => {
    const payload = {
      ...data,
      burstLimitDown: data.burstLimitDown ?? null,
      burstLimitUp: data.burstLimitUp ?? null,
      burstThresholdDown: data.burstThresholdDown ?? null,
      burstThresholdUp: data.burstThresholdUp ?? null,
      burstTimeSeconds: data.burstTimeSeconds ?? null,
      priority: data.priority ?? null,
      limitAtDown: data.limitAtDown ?? null,
      limitAtUp: data.limitAtUp ?? null,
    };
    try {
      setSubmitting(true);
      if (isEditing && initialData) {
        await updateProfile(initialData.id, payload);
        toast.success(`Profil ${data.name} berhasil diperbarui.`);
      } else {
        await createProfile(payload);
        toast.success(`Profil paket ${data.name} berhasil dibuat.`);
      }
      router.push("/profiles");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menyimpan profil bandwidth.");
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
          <Link href="/profiles">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Daftar Profil
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Zap className="h-5 w-5" />
            <CardTitle className="text-base">
              {isEditing ? "Edit Profil Bandwidth" : "Tambah Profil Paket Baru"}
            </CardTitle>
          </div>
          <CardDescription>
            Menentukan batasan kecepatan rate-limit yang akan dikirim via RADIUS
            attribute (<code>Mikrotik-Rate-Limit</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nama Profil / Paket <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="mis. Paket Home 20 Mbps"
              {...register("name")}
              className={errors.name ? "border-rose-500" : ""}
            />
            {errors.name && (
              <p className="text-xs text-rose-500">{errors.name.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label
                htmlFor="rateLimitDown"
                className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400"
              >
                <ArrowDown className="h-4 w-4" />
                Batas Kecepatan Download (Mbps){" "}
                <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="rateLimitDown"
                type="number"
                min={1}
                placeholder="mis. 20"
                {...register("rateLimitDown", { valueAsNumber: true })}
                className={errors.rateLimitDown ? "border-rose-500" : ""}
              />
              {errors.rateLimitDown && (
                <p className="text-xs text-rose-500">
                  {errors.rateLimitDown.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="rateLimitUp"
                className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400"
              >
                <ArrowUp className="h-4 w-4" />
                Batas Kecepatan Upload (Mbps){" "}
                <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="rateLimitUp"
                type="number"
                min={1}
                placeholder="mis. 10"
                {...register("rateLimitUp", { valueAsNumber: true })}
                className={errors.rateLimitUp ? "border-rose-500" : ""}
              />
              {errors.rateLimitUp && (
                <p className="text-xs text-rose-500">
                  {errors.rateLimitUp.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="price"
              className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"
            >
              <Wallet className="h-4 w-4" />
              Harga Paket Bulanan (Rp) <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="price"
              type="number"
              min={1}
              placeholder="mis. 165000"
              {...register("price", { valueAsNumber: true })}
              className={errors.price ? "border-rose-500" : ""}
            />
            {errors.price && (
              <p className="text-xs text-rose-500">{errors.price.message}</p>
            )}
            <p className="text-[11px] text-slate-400">
              Harga ini otomatis dipakai sebagai tarif pokok (subtotal) saat
              membuat tagihan / invoice pelanggan.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Deskripsi & Catatan Paket (Opsional)
            </Label>
            <Input
              id="description"
              placeholder="mis. Paket internet rumah untuk streaming dan video conference"
              {...register("description")}
            />
          </div>
        </CardContent>
      </Card>

      {/* QoS Lanjutan MikroTik — burst / priority / limit-at */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <Zap className="h-5 w-5" />
            <CardTitle className="text-base">
              QoS Lanjutan (Mikrotik-Rate-Limit)
            </CardTitle>
          </div>
          <CardDescription>
            Opsional. Kosongkan bila tidak ingin memakai
            burst/priority/limit-at. Satuan kecepatan dalam <b>kbps</b>. Format
            RADIUS yang dihasilkan misalnya:{" "}
            <code className="text-xs">
              1M/1M 1500k/1500k 512k/512k 12/12 8 64k/64k
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(warnBurstDown || warnBurstUp) && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              ⚠️ Burst limit lebih kecil dari max-limit{" "}
              {warnBurstDown && "Download "}
              {warnBurstUp && "Upload"}. RouterOS akan menolak queue dengan
              pesan "download-burst-limit less than download-max-limit". Naikkan
              burst limit minimal sama dengan max-limit, atau kosongkan.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="burstLimitDown">
                Burst Limit Download (kbps)
              </Label>
              <Input
                id="burstLimitDown"
                type="number"
                min={1}
                placeholder="mis. 1500"
                {...register("burstLimitDown", { valueAsNumber: true })}
                className={warnBurstDown ? "border-amber-500" : ""}
              />
              <p className="text-[11px] text-slate-400">
                Kecepatan puncak saat burst aktif. Contoh: 1500k. Tidak boleh
                lebih kecil dari max-limit.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="burstLimitUp">Burst Limit Upload (kbps)</Label>
              <Input
                id="burstLimitUp"
                type="number"
                min={1}
                placeholder="mis. 1500"
                {...register("burstLimitUp", { valueAsNumber: true })}
                className={warnBurstUp ? "border-amber-500" : ""}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="burstThresholdDown">
                Burst Threshold Download (kbps)
              </Label>
              <Input
                id="burstThresholdDown"
                type="number"
                min={1}
                placeholder="mis. 512"
                {...register("burstThresholdDown", { valueAsNumber: true })}
              />
              <p className="text-[11px] text-slate-400">
                Ambang kecepatan rata-rata; di atas ini burst dimatikan.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="burstThresholdUp">
                Burst Threshold Upload (kbps)
              </Label>
              <Input
                id="burstThresholdUp"
                type="number"
                min={1}
                placeholder="mis. 512"
                {...register("burstThresholdUp", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="burstTimeSeconds">Burst Time (detik)</Label>
              <Input
                id="burstTimeSeconds"
                type="number"
                min={1}
                max={600}
                placeholder="mis. 12"
                {...register("burstTimeSeconds", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority (1–8)</Label>
              <Input
                id="priority"
                type="number"
                min={1}
                max={8}
                placeholder="8"
                {...register("priority", { valueAsNumber: true })}
              />
              <p className="text-[11px] text-slate-400">1 = tertinggi</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="limitAtDown">
                Limit-at Download (kbps / CIR)
              </Label>
              <Input
                id="limitAtDown"
                type="number"
                min={1}
                placeholder="mis. 64"
                {...register("limitAtDown", { valueAsNumber: true })}
              />
              <p className="text-[11px] text-slate-400">
                Kecepatan minimum terjamin (Committed Info Rate).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="limitAtUp">Limit-at Upload (kbps / CIR)</Label>
              <Input
                id="limitAtUp"
                type="number"
                min={1}
                placeholder="mis. 64"
                {...register("limitAtUp", { valueAsNumber: true })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
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
          {isEditing ? "Simpan Perubahan" : "Simpan Profil Paket"}
        </Button>
      </div>
    </form>
  );
}
