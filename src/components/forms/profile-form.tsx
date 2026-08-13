"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "nextjs-toploader/app";
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

const profileSchema = z.object({
  name: z.string().min(3, "Nama profil minimal 3 karakter"),
  rateLimitDown: z.number().min(1, "Batas download minimal 1 Mbps"),
  rateLimitUp: z.number().min(1, "Batas upload minimal 1 Mbps"),
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
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initialData?.name || "",
      rateLimitDown: initialData?.rateLimitDown || 10,
      rateLimitUp: initialData?.rateLimitUp || 5,
      description: initialData?.description || "",
    },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    try {
      setSubmitting(true);
      if (isEditing && initialData) {
        await updateProfile(initialData.id, data);
        toast.success(`Profil ${data.name} berhasil diperbarui.`);
      } else {
        await createProfile(data);
        toast.success(`Profil paket ${data.name} berhasil dibuat.`);
      }
      router.push("/profiles");
    } catch (err: any) {
      toast.error(err?.message || "Gagal menyimpan profil bandwidth.");
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
