"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Activity, ArrowLeft, Flame, Gauge, Loader2, Zap } from "lucide-react";
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
  useCreateBandwidthMutation,
  useUpdateBandwidthMutation,
} from "@/lib/api/hooks";
import { formatBandwidthRateLimit } from "@/lib/radius-format";
import type { Bandwidth, RateUnit } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

function toKbps(val: number, unit?: string | null): number {
  const isMbps = (unit ?? "Mbps").toLowerCase().startsWith("m");
  return isMbps ? val * 1000 : val;
}

const bandwidthSchema = z
  .object({
    name: z.string().min(3, "Nama bandwidth minimal 3 karakter"),
    minDownload: z.number().nullable().optional(),
    minDownloadUnit: z.enum(["Kbps", "Mbps"]),
    minUpload: z.number().nullable().optional(),
    minUploadUnit: z.enum(["Kbps", "Mbps"]),
    maxDownload: z.number().min(1, "Max download wajib diisi minimal 1"),
    maxDownloadUnit: z.enum(["Kbps", "Mbps"]),
    maxUpload: z.number().min(1, "Max upload wajib diisi minimal 1"),
    maxUploadUnit: z.enum(["Kbps", "Mbps"]),
    burstLimitDownload: z.number().nullable().optional(),
    burstLimitDownloadUnit: z.enum(["Kbps", "Mbps"]),
    burstLimitUpload: z.number().nullable().optional(),
    burstLimitUploadUnit: z.enum(["Kbps", "Mbps"]),
    burstThresholdDownload: z.number().nullable().optional(),
    burstThresholdDownloadUnit: z.enum(["Kbps", "Mbps"]),
    burstThresholdUpload: z.number().nullable().optional(),
    burstThresholdUploadUnit: z.enum(["Kbps", "Mbps"]),
    burstTime: z.number().int().min(1).max(600).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // 1) Validasi Limit-At (Garansi Min / CIR): Tidak boleh melebihi Max limit
    if (
      data.minDownload &&
      data.minDownload > 0 &&
      data.maxDownload &&
      data.maxDownload > 0
    ) {
      const minDownKbps = toKbps(data.minDownload, data.minDownloadUnit);
      const maxDownKbps = toKbps(data.maxDownload, data.maxDownloadUnit);
      if (minDownKbps > maxDownKbps) {
        ctx.addIssue({
          code: "custom",
          path: ["minDownload"],
          message:
            "Garansi Min (Limit-at) Download tidak boleh melebihi Max Download",
        });
      }
    }

    if (
      data.minUpload &&
      data.minUpload > 0 &&
      data.maxUpload &&
      data.maxUpload > 0
    ) {
      const minUpKbps = toKbps(data.minUpload, data.minUploadUnit);
      const maxUpKbps = toKbps(data.maxUpload, data.maxUploadUnit);
      if (minUpKbps > maxUpKbps) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["minUpload"],
          message:
            "Garansi Min (Limit-at) Upload tidak boleh melebihi Max Upload",
        });
      }
    }

    // 2) Validasi Burst (QoS): Burst limit harus lebih besar dari Max (di atas max)
    const hasAnyBurst = Boolean(
      (data.burstLimitDownload && data.burstLimitDownload > 0) ||
        (data.burstLimitUpload && data.burstLimitUpload > 0) ||
        (data.burstThresholdDownload && data.burstThresholdDownload > 0) ||
        (data.burstThresholdUpload && data.burstThresholdUpload > 0) ||
        (data.burstTime && data.burstTime > 0),
    );

    if (hasAnyBurst) {
      if (!data.burstLimitDownload || data.burstLimitDownload <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["burstLimitDownload"],
          message: "Burst limit download wajib diisi jika burst diaktifkan",
        });
      } else if (data.maxDownload && data.maxDownload > 0) {
        const burstDownKbps = toKbps(
          data.burstLimitDownload,
          data.burstLimitDownloadUnit,
        );
        const maxDownKbps = toKbps(data.maxDownload, data.maxDownloadUnit);
        if (burstDownKbps <= maxDownKbps) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["burstLimitDownload"],
            message: "Burst Limit Download harus lebih besar dari Max Download",
          });
        }
      }

      if (!data.burstLimitUpload || data.burstLimitUpload <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["burstLimitUpload"],
          message: "Burst limit upload wajib diisi jika burst diaktifkan",
        });
      } else if (data.maxUpload && data.maxUpload > 0) {
        const burstUpKbps = toKbps(
          data.burstLimitUpload,
          data.burstLimitUploadUnit,
        );
        const maxUpKbps = toKbps(data.maxUpload, data.maxUploadUnit);
        if (burstUpKbps <= maxUpKbps) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["burstLimitUpload"],
            message: "Burst Limit Upload harus lebih besar dari Max Upload",
          });
        }
      }

      if (!data.burstThresholdDownload || data.burstThresholdDownload <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["burstThresholdDownload"],
          message: "Burst threshold download wajib diisi jika burst diaktifkan",
        });
      } else if (data.burstLimitDownload && data.burstLimitDownload > 0) {
        const threshDownKbps = toKbps(
          data.burstThresholdDownload,
          data.burstThresholdDownloadUnit,
        );
        const burstDownKbps = toKbps(
          data.burstLimitDownload,
          data.burstLimitDownloadUnit,
        );
        if (threshDownKbps > burstDownKbps) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["burstThresholdDownload"],
            message:
              "Burst Threshold Download tidak boleh melebihi Burst Limit Download",
          });
        }
      }

      if (!data.burstThresholdUpload || data.burstThresholdUpload <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["burstThresholdUpload"],
          message: "Burst threshold upload wajib diisi jika burst diaktifkan",
        });
      } else if (data.burstLimitUpload && data.burstLimitUpload > 0) {
        const threshUpKbps = toKbps(
          data.burstThresholdUpload,
          data.burstThresholdUploadUnit,
        );
        const burstUpKbps = toKbps(
          data.burstLimitUpload,
          data.burstLimitUploadUnit,
        );
        if (threshUpKbps > burstUpKbps) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["burstThresholdUpload"],
            message:
              "Burst Threshold Upload tidak boleh melebihi Burst Limit Upload",
          });
        }
      }

      if (!data.burstTime || data.burstTime <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["burstTime"],
          message: "Burst time wajib diisi (detik) jika burst diaktifkan",
        });
      }
    }
  });

type BandwidthFormValues = z.infer<typeof bandwidthSchema>;

interface BandwidthFormProps {
  initialData?: Bandwidth;
  isEditing?: boolean;
}

export function BandwidthForm({
  initialData,
  isEditing = false,
}: BandwidthFormProps) {
  const router = useRouter();
  const createMutation = useCreateBandwidthMutation();
  const updateMutation = useUpdateBandwidthMutation();

  const submitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<BandwidthFormValues>({
    resolver: zodResolver(bandwidthSchema),
    defaultValues: {
      name: initialData?.name || "",
      minDownload: initialData?.minDownload || null,
      minDownloadUnit: (initialData?.minDownloadUnit as RateUnit) || "Kbps",
      minUpload: initialData?.minUpload || null,
      minUploadUnit: (initialData?.minUploadUnit as RateUnit) || "Kbps",
      maxDownload: initialData?.maxDownload || 10,
      maxDownloadUnit: (initialData?.maxDownloadUnit as RateUnit) || "Mbps",
      maxUpload: initialData?.maxUpload || 5,
      maxUploadUnit: (initialData?.maxUploadUnit as RateUnit) || "Mbps",
      burstLimitDownload: initialData?.burstLimitDownload || null,
      burstLimitDownloadUnit:
        (initialData?.burstLimitDownloadUnit as RateUnit) || "Mbps",
      burstLimitUpload: initialData?.burstLimitUpload || null,
      burstLimitUploadUnit:
        (initialData?.burstLimitUploadUnit as RateUnit) || "Mbps",
      burstThresholdDownload: initialData?.burstThresholdDownload || null,
      burstThresholdDownloadUnit:
        (initialData?.burstThresholdDownloadUnit as RateUnit) || "Mbps",
      burstThresholdUpload: initialData?.burstThresholdUpload || null,
      burstThresholdUploadUnit:
        (initialData?.burstThresholdUploadUnit as RateUnit) || "Mbps",
      burstTime: initialData?.burstTime || null,
    },
  });

  const watchedValues = watch();

  const rateLimitPreview = formatBandwidthRateLimit(
    {
      maxDownload: watchedValues.maxDownload || 1,
      maxDownloadUnit: watchedValues.maxDownloadUnit,
      maxUpload: watchedValues.maxUpload || 1,
      maxUploadUnit: watchedValues.maxUploadUnit,
      minDownload: watchedValues.minDownload,
      minDownloadUnit: watchedValues.minDownloadUnit,
      minUpload: watchedValues.minUpload,
      minUploadUnit: watchedValues.minUploadUnit,
      burstLimitDownload: watchedValues.burstLimitDownload,
      burstLimitDownloadUnit: watchedValues.burstLimitDownloadUnit,
      burstLimitUpload: watchedValues.burstLimitUpload,
      burstLimitUploadUnit: watchedValues.burstLimitUploadUnit,
      burstThresholdDownload: watchedValues.burstThresholdDownload,
      burstThresholdDownloadUnit: watchedValues.burstThresholdDownloadUnit,
      burstThresholdUpload: watchedValues.burstThresholdUpload,
      burstThresholdUploadUnit: watchedValues.burstThresholdUploadUnit,
      burstTime: watchedValues.burstTime,
    },
    8,
  );

  const onSubmit = async (values: BandwidthFormValues) => {
    try {
      if (isEditing && initialData) {
        await updateMutation.mutateAsync({
          id: initialData.id,
          data: values,
        });
        toast.success("Konfigurasi bandwidth berhasil diperbarui");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Konfigurasi bandwidth berhasil ditambahkan");
      }
      router.push("/bandwidths");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-9 w-9">
            <Link href="/bandwidths">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isEditing
                ? "Edit Konfigurasi Bandwidth"
                : "Tambah Bandwidth Baru"}
            </h1>
            <p className="text-xs text-slate-500">
              Atur kecepatan dasar (CIR/MIR) dan burst limit QoS MikroTik.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/bandwidths">Batal</Link>
          </Button>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Simpan Perubahan" : "Buat Bandwidth"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Card 1: Nama & Kecepatan Utama */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-base">
                  Kecepatan Maksimal (MIR)
                </CardTitle>
              </div>
              <CardDescription>
                Kecepatan puncak normal yang didapatkan pelanggan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nama Bandwidth</Label>
                <Input
                  id="name"
                  placeholder="Contoh: 20 Mbps Simetris / 10M-Up-To-20M"
                  {...register("name")}
                  className="mt-1"
                />
                {errors.name && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="maxDownload">Max Download</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="maxDownload"
                      type="number"
                      min={1}
                      {...register("maxDownload", { valueAsNumber: true })}
                    />
                    <Select
                      value={watchedValues.maxDownloadUnit}
                      onValueChange={(v) =>
                        setValue("maxDownloadUnit", v as RateUnit)
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mbps">Mbps</SelectItem>
                        <SelectItem value="Kbps">Kbps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.maxDownload && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.maxDownload.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="maxUpload">Max Upload</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="maxUpload"
                      type="number"
                      min={1}
                      {...register("maxUpload", { valueAsNumber: true })}
                    />
                    <Select
                      value={watchedValues.maxUploadUnit}
                      onValueChange={(v) =>
                        setValue("maxUploadUnit", v as RateUnit)
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mbps">Mbps</SelectItem>
                        <SelectItem value="Kbps">Kbps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.maxUpload && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.maxUpload.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Kecepatan Minimum / Terjamin (CIR / Limit-At) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-base">
                  Kecepatan Minimal / Garansi (CIR / Limit-At)
                </CardTitle>
              </div>
              <CardDescription>
                Opsional — Batas bandwidth minimal yang dijamin saat trafik
                jaringan padat.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="minDownload">Min Download (Opsional)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="minDownload"
                      type="number"
                      min={1}
                      placeholder="Contoh: 2048"
                      {...register("minDownload", {
                        setValueAs: (v) =>
                          v === "" || v === null ? null : Number(v),
                      })}
                    />
                    <Select
                      value={watchedValues.minDownloadUnit}
                      onValueChange={(v) =>
                        setValue("minDownloadUnit", v as RateUnit)
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Kbps">Kbps</SelectItem>
                        <SelectItem value="Mbps">Mbps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.minDownload && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.minDownload.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="minUpload">Min Upload (Opsional)</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="minUpload"
                      type="number"
                      min={1}
                      placeholder="Contoh: 1024"
                      {...register("minUpload", {
                        setValueAs: (v) =>
                          v === "" || v === null ? null : Number(v),
                      })}
                    />
                    <Select
                      value={watchedValues.minUploadUnit}
                      onValueChange={(v) =>
                        setValue("minUploadUnit", v as RateUnit)
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Kbps">Kbps</SelectItem>
                        <SelectItem value="Mbps">Mbps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.minUpload && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.minUpload.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Konfigurasi Burst (QoS) */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-600" />
                <CardTitle className="text-base">
                  Konfigurasi Burst (Opsional)
                </CardTitle>
              </div>
              <CardDescription>
                Meningkatkan kecepatan sementara di atas MIR selama beberapa
                detik saat browsing awal. Jika salah satu diisi, seluruh field
                burst wajib diisi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="burstLimitDownload">
                    Burst Limit Download
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="burstLimitDownload"
                      type="number"
                      min={1}
                      placeholder="Misal 30"
                      {...register("burstLimitDownload", {
                        setValueAs: (v) =>
                          v === "" || v === null ? null : Number(v),
                      })}
                    />
                    <Select
                      value={watchedValues.burstLimitDownloadUnit}
                      onValueChange={(v) =>
                        setValue("burstLimitDownloadUnit", v as RateUnit)
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mbps">Mbps</SelectItem>
                        <SelectItem value="Kbps">Kbps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.burstLimitDownload && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.burstLimitDownload.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="burstLimitUpload">Burst Limit Upload</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="burstLimitUpload"
                      type="number"
                      min={1}
                      placeholder="Misal 15"
                      {...register("burstLimitUpload", {
                        setValueAs: (v) =>
                          v === "" || v === null ? null : Number(v),
                      })}
                    />
                    <Select
                      value={watchedValues.burstLimitUploadUnit}
                      onValueChange={(v) =>
                        setValue("burstLimitUploadUnit", v as RateUnit)
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mbps">Mbps</SelectItem>
                        <SelectItem value="Kbps">Kbps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.burstLimitUpload && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.burstLimitUpload.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="burstThresholdDownload">
                    Burst Threshold Download
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="burstThresholdDownload"
                      type="number"
                      min={1}
                      placeholder="Misal 15"
                      {...register("burstThresholdDownload", {
                        setValueAs: (v) =>
                          v === "" || v === null ? null : Number(v),
                      })}
                    />
                    <Select
                      value={watchedValues.burstThresholdDownloadUnit}
                      onValueChange={(v) =>
                        setValue("burstThresholdDownloadUnit", v as RateUnit)
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mbps">Mbps</SelectItem>
                        <SelectItem value="Kbps">Kbps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.burstThresholdDownload && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.burstThresholdDownload.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="burstThresholdUpload">
                    Burst Threshold Upload
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="burstThresholdUpload"
                      type="number"
                      min={1}
                      placeholder="Misal 8"
                      {...register("burstThresholdUpload", {
                        setValueAs: (v) =>
                          v === "" || v === null ? null : Number(v),
                      })}
                    />
                    <Select
                      value={watchedValues.burstThresholdUploadUnit}
                      onValueChange={(v) =>
                        setValue("burstThresholdUploadUnit", v as RateUnit)
                      }
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mbps">Mbps</SelectItem>
                        <SelectItem value="Kbps">Kbps</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.burstThresholdUpload && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.burstThresholdUpload.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="burstTime">Burst Time (Detik)</Label>
                <Input
                  id="burstTime"
                  type="number"
                  min={1}
                  max={600}
                  placeholder="Contoh: 10 detik"
                  className="mt-1 max-w-xs"
                  {...register("burstTime", {
                    setValueAs: (v) =>
                      v === "" || v === null ? null : Number(v),
                  })}
                />
                {errors.burstTime && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.burstTime.message}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  Durasi running-average burst yang diizinkan (biasanya 4–16
                  detik).
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Preview */}
        <div>
          <Card className="sticky top-6 border-blue-100 bg-blue-50/40 dark:border-blue-900/30 dark:bg-blue-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-base">
                  MikroTik Rate-Limit Preview
                </CardTitle>
              </div>
              <CardDescription>
                Format string atribut RADIUS yang dikirim ke MikroTik.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="rounded-md bg-white p-3 font-mono text-xs text-blue-950 shadow-xs dark:bg-slate-900 dark:text-blue-200 break-all">
                {rateLimitPreview || "10M/5M"}
              </div>
              <div className="space-y-1.5 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Download Puncak:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {watchedValues.maxDownload} {watchedValues.maxDownloadUnit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Upload Puncak:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {watchedValues.maxUpload} {watchedValues.maxUploadUnit}
                  </span>
                </div>
                {watchedValues.minDownload && (
                  <div className="flex justify-between">
                    <span>Garansi Min (CIR):</span>
                    <span className="font-semibold">
                      {watchedValues.minDownload}{" "}
                      {watchedValues.minDownloadUnit} /{" "}
                      {watchedValues.minUpload} {watchedValues.minUploadUnit}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
