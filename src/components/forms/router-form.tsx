"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  KeyRound,
  Loader2,
  Router as RouterIcon,
} from "lucide-react";
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
  useCreateRouterMutation,
  useUpdateRouterMutation,
} from "@/lib/api/hooks";
import type { RouterPayload } from "@/lib/api/routers";
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
  apiUsername: z.string().trim().optional(),
  apiPassword: z.string().optional(),
  apiPort: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z
      .number({ message: "Port API harus angka (default 8728)" })
      .int()
      .min(1)
      .max(65535),
  ),
  radiusSecret: z.string().trim().optional(),
  syncEnabled: z.boolean().default(true),
});

// zod v4: preprocess mengubah input (string) → output (number), jadi kita
// pakai generic 3-kali RHF: input type utk form state, output type utk submit.
type RouterFormInput = z.input<typeof routerSchema>;
type RouterFormValues = z.output<typeof routerSchema>;

interface RouterFormProps {
  initialData?: NasRouter;
  isEditing?: boolean;
}

export function RouterForm({
  initialData,
  isEditing = false,
}: RouterFormProps) {
  const router = useRouter();
  const createRouterMutation = useCreateRouterMutation();
  const updateRouterMutation = useUpdateRouterMutation();

  const submitting =
    createRouterMutation.isPending || updateRouterMutation.isPending;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RouterFormInput, unknown, RouterFormValues>({
    resolver: zodResolver(routerSchema),
    defaultValues: {
      name: initialData?.name || "",
      ipAddress: initialData?.ipAddress || "",
      location: initialData?.location || "",
      status: initialData?.status || "online",
      apiUsername: initialData?.apiUsername || "",
      apiPassword: "",
      apiPort: initialData?.apiPort ?? 8728,
      radiusSecret: initialData?.radiusSecret || "",
      syncEnabled: initialData?.syncEnabled ?? true,
    },
  });

  const selectedStatus = watch("status");

  const onSubmit = async (data: RouterFormValues) => {
    try {
      if (isEditing && initialData) {
        // Hanya kirim apiPassword bila diisi ulang (jangan timpa tersimpan)
        const payload: Partial<RouterPayload> = {
          name: data.name,
          ipAddress: data.ipAddress,
          location: data.location,
          status: data.status as NasRouterStatus,
          apiUsername: data.apiUsername || undefined,
          apiPort: data.apiPort,
          radiusSecret: data.radiusSecret || undefined,
          syncEnabled: data.syncEnabled,
        };
        if (data.apiPassword) payload.apiPassword = data.apiPassword;
        await updateRouterMutation.mutateAsync({
          id: initialData.id,
          updates: payload,
        });
        toast.success(`Router ${data.name} berhasil diperbarui.`);
      } else {
        await createRouterMutation.mutateAsync({
          name: data.name,
          ipAddress: data.ipAddress,
          location: data.location,
          type: "mikrotik",
          status: data.status as NasRouterStatus,
          apiUsername: data.apiUsername || undefined,
          apiPassword: data.apiPassword || undefined,
          apiPort: data.apiPort,
          radiusSecret: data.radiusSecret || undefined,
          syncEnabled: data.syncEnabled,
        });
        toast.success(`Router NAS ${data.name} berhasil ditambahkan.`);
      }
      router.push("/routers");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menyimpan router NAS.");
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
            <code>nas</code>) — IP ini diizinkan mengirim Access-Request.
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
              placeholder="mis. 192.168.88.1 / 10.90.20.238"
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

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <KeyRound className="h-5 w-5" />
            <CardTitle className="text-base">
              Koneksi API & FreeRADIUS
            </CardTitle>
          </div>
          <CardDescription>
            Kredensial API RouterOS untuk sinkronisasi sesi (Test Ping,
            Sinkronkan, Hubungkan ke FreeRADIUS). Radius Secret harus sama
            dengan shared secret di FreeRADIUS (<code>nas.secret</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apiUsername">API Username RouterOS</Label>
              <Input
                id="apiUsername"
                placeholder="mis. zen / admin"
                autoComplete="off"
                {...register("apiUsername")}
              />
              <p className="text-xs text-slate-500">
                User dengan hak <code>read</code>, <code>write</code>,{" "}
                <code>policy</code>, <code>test</code>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiPassword">
                API Password{" "}
                {isEditing && initialData?.apiPasswordSet && (
                  <span className="text-xs font-normal text-emerald-600">
                    (tersimpan — kosongkan jika tidak diganti)
                  </span>
                )}
              </Label>
              <Input
                id="apiPassword"
                type="password"
                autoComplete="new-password"
                placeholder={
                  isEditing && initialData?.apiPasswordSet
                    ? "•••••••• (tidak diubah)"
                    : "mis. mezen"
                }
                {...register("apiPassword")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="apiPort">API Port</Label>
              <Input
                id="apiPort"
                type="number"
                placeholder="8728"
                {...register("apiPort")}
                className={errors.apiPort ? "border-rose-500" : ""}
              />
              {errors.apiPort && (
                <p className="text-xs text-rose-500">
                  {errors.apiPort.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="radiusSecret">RADIUS Shared Secret</Label>
              <Input
                id="radiusSecret"
                type="password"
                autoComplete="new-password"
                placeholder={isEditing ? "testing123" : "isi secret FreeRADIUS"}
                {...register("radiusSecret")}
              />
              <p className="text-xs text-slate-500">
                Sama dengan <code>/radius secret</code> di router & FreeRADIUS.
              </p>
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 cursor-pointer dark:border-slate-800">
            <input
              type="checkbox"
              {...register("syncEnabled")}
              className="mt-0.5 h-4 w-4 accent-blue-600"
            />
            <span className="text-sm leading-snug">
              <span className="font-medium">
                Sinkronisasi otomatis sesi PPPoE
              </span>
              <span className="block text-xs text-slate-500">
                Poller membaca <code>/ppp/active</code> tiap 10 detik untuk
                memperbarui sesi & traffic. Matikan jika hanya memakai RADIUS
                accounting.
              </span>
            </span>
          </label>
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
