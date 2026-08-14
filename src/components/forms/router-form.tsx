"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Router as RouterIcon } from "lucide-react";
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
import { createRouter, updateRouter } from "@/lib/api/routers";
import type { NasRouter, NasRouterStatus } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

const ipv4Regex =
  /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

const routerSchema = z.object({
  name: z.string().min(2, "Nama router minimal 2 karakter"),
  ipAddress: z
    .string()
    .min(1, "IP Address wajib diisi")
    .regex(ipv4Regex, "Format IPv4 tidak valid (contoh: 192.168.88.1)"),
  location: z.string().optional(),
  status: z.enum(["online", "offline", "unknown"]),
});

type RouterFormValues = z.infer<typeof routerSchema>;

interface RouterFormProps {
  initialData?: NasRouter;
  isEditing?: boolean;
}

export function RouterForm({
  initialData,
  isEditing = false,
}: RouterFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RouterFormValues>({
    resolver: zodResolver(routerSchema),
    defaultValues: {
      name: initialData?.name || "",
      ipAddress: initialData?.ipAddress || "",
      location: initialData?.location || "",
      status: initialData?.status || "online",
    },
  });

  const selectedStatus = watch("status");

  const onSubmit = async (data: RouterFormValues) => {
    try {
      setSubmitting(true);
      if (isEditing && initialData) {
        await updateRouter(initialData.id, {
          name: data.name,
          ipAddress: data.ipAddress,
          location: data.location,
          status: data.status as NasRouterStatus,
        });
        toast.success(`Router ${data.name} berhasil diperbarui.`);
      } else {
        await createRouter({
          name: data.name,
          ipAddress: data.ipAddress,
          location: data.location,
          type: "mikrotik",
          status: data.status as NasRouterStatus,
        });
        toast.success(`Router NAS ${data.name} berhasil ditambahkan.`);
      }
      router.push("/routers");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menyimpan router NAS.");
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
          <Link href="/routers">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Daftar Router
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <RouterIcon className="h-5 w-5" />
            <CardTitle className="text-base">
              {isEditing
                ? "Edit NAS Router MikroTik"
                : "Tambah NAS Router Baru"}
            </CardTitle>
          </div>
          <CardDescription>
            Router MikroTik yang terdaftar di database FreeRADIUS (tabel{" "}
            <code>nas</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nama Router (Shortname) <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="mis. CCR2004-Core-DC"
              {...register("name")}
              className={errors.name ? "border-rose-500" : ""}
            />
            {errors.name && (
              <p className="text-xs text-rose-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="ipAddress">
              IP Address Router (nasname){" "}
              <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="ipAddress"
              placeholder="mis. 192.168.88.1"
              {...register("ipAddress")}
              className={errors.ipAddress ? "border-rose-500" : ""}
            />
            {errors.ipAddress && (
              <p className="text-xs text-rose-500">
                {errors.ipAddress.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Lokasi / Keterangan Penempatan</Label>
            <Input
              id="location"
              placeholder="mis. NOC Data Center Rak A-02 / Tower Utara"
              {...register("location")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status Router</Label>
            <Select
              value={selectedStatus}
              onValueChange={(val) =>
                setValue("status", val as NasRouterStatus, {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Pilih Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">🟢 Online (Terhubung)</SelectItem>
                <SelectItem value="offline">
                  🔴 Offline (Tidak Terjangkau)
                </SelectItem>
                <SelectItem value="unknown">⚪ Unknown</SelectItem>
              </SelectContent>
            </Select>
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
          {isEditing ? "Simpan Perubahan" : "Simpan Router NAS"}
        </Button>
      </div>
    </form>
  );
}
