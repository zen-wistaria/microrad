"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Database,
  Globe,
  Loader2,
  Network,
  Server,
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
  useCreateProfileGroupMutation,
  useRoutersQuery,
  useUpdateProfileGroupMutation,
} from "@/lib/api/hooks";
import type { IpModuleType, NasRouter, ProfileGroup } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

const ipv4Regex =
  /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

function ipToNumber(ip: string): number {
  const parts = ip.trim().split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
  ) {
    return 0;
  }
  return (
    ((parts[0] << 24) >>> 0) +
    ((parts[1] << 16) >>> 0) +
    ((parts[2] << 8) >>> 0) +
    (parts[3] >>> 0)
  );
}

const profileGroupSchema = z
  .object({
    name: z.string().min(3, "Nama Profile Group minimal 3 karakter"),
    nasId: z.string().min(1, "Wajib memilih Router NAS"),
    type: z.enum(["PPP"]),
    ipModule: z.enum(["sql", "mikrotik_pool"]),
    localAddress: z
      .string()
      .regex(
        ipv4Regex,
        "Format Local Address (IPv4) tidak valid (contoh: 10.10.10.1)",
      ),
    rangeIpStart: z
      .string()
      .regex(
        ipv4Regex,
        "Format Range IP Start (IPv4) tidak valid (contoh: 10.10.10.2)",
      ),
    rangeIpEnd: z
      .string()
      .regex(
        ipv4Regex,
        "Format Range IP End (IPv4) tidak valid (contoh: 10.10.10.254)",
      ),
    dnsServers: z
      .string()
      .min(7, "Format DNS minimal 1 IP valid (misal: 8.8.8.8,8.8.4.4)"),
    parentQueue: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const localNum = ipToNumber(data.localAddress);
    const startNum = ipToNumber(data.rangeIpStart);
    const endNum = ipToNumber(data.rangeIpEnd);

    if (startNum > 0 && endNum > 0 && startNum > endNum) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rangeIpStart"],
        message:
          "Range IP Start harus lebih kecil atau sama dengan Range IP End",
      });
    }

    if (localNum > 0 && startNum > 0 && endNum > 0) {
      if (localNum >= startNum && localNum <= endNum) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["localAddress"],
          message: `Local Address Gateway (${data.localAddress}) tidak boleh berada di dalam rentang client (${data.rangeIpStart} - ${data.rangeIpEnd})`,
        });
      }
    }
  });

type ProfileGroupFormValues = z.infer<typeof profileGroupSchema>;

interface ProfileGroupFormProps {
  initialData?: ProfileGroup;
  isEditing?: boolean;
}

export function ProfileGroupForm({
  initialData,
  isEditing = false,
}: ProfileGroupFormProps) {
  const router = useRouter();
  const { data: routers = [] } = useRoutersQuery();

  const createMutation = useCreateProfileGroupMutation();
  const updateMutation = useUpdateProfileGroupMutation();

  const submitting = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileGroupFormValues>({
    resolver: zodResolver(profileGroupSchema),
    defaultValues: {
      name: initialData?.name || "",
      nasId: initialData?.nasId || "",
      type: "PPP",
      ipModule: (initialData?.ipModule as IpModuleType) || "sql",
      localAddress: initialData?.localAddress || "10.10.10.1",
      rangeIpStart: initialData?.rangeIpStart || "10.10.10.2",
      rangeIpEnd: initialData?.rangeIpEnd || "10.10.10.254",
      dnsServers: initialData?.dnsServers || "8.8.8.8,8.8.4.4",
      parentQueue: initialData?.parentQueue || "",
    },
  });

  const watchedValues = watch();

  const onSubmit = async (values: ProfileGroupFormValues) => {
    try {
      if (isEditing && initialData) {
        await updateMutation.mutateAsync({
          id: initialData.id,
          data: values,
        });
        toast.success("Profile Group berhasil diperbarui");
      } else {
        await createMutation.mutateAsync(values);
        toast.success("Profile Group berhasil dibuat");
      }
      router.push("/profile-groups");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="h-9 w-9">
            <Link href="/profile-groups">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isEditing ? "Edit Profile Group" : "Tambah Profile Group"}
            </h1>
            <p className="text-xs text-slate-500">
              Pengaturan asosiasi Router NAS, modul IP pool, gateway, dan DNS
              server.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/profile-groups">Batal</Link>
          </Button>
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Simpan Perubahan" : "Buat Profile Group"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Card 1: Identitas & Router NAS */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-base">
                  Informasi Grup & NAS
                </CardTitle>
              </div>
              <CardDescription>
                Pilih router tujuan dan jenis service profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Nama Profile Group</Label>
                <Input
                  id="name"
                  placeholder="Contoh: Group-MikroTik-Node1 / Pool-Pelanggan-Utara"
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
                  <Label htmlFor="nasId">Router NAS</Label>
                  <Select
                    value={watchedValues.nasId}
                    onValueChange={(v) =>
                      setValue("nasId", v, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger id="nasId" className="mt-1">
                      <SelectValue placeholder="Pilih Router NAS..." />
                    </SelectTrigger>
                    <SelectContent>
                      {routers.map((r: NasRouter) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} ({r.ipAddress})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.nasId && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.nasId.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="type">Tipe Layanan</Label>
                  <Select
                    value={watchedValues.type}
                    onValueChange={(v) =>
                      setValue("type", v as "PPP", { shouldValidate: true })
                    }
                  >
                    <SelectTrigger id="type" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PPP">
                        PPP (PPPoE / L2TP / PPTP)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Pengaturan IP Pool & Gateway */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-base">
                  Konfigurasi IP & Gateway
                </CardTitle>
              </div>
              <CardDescription>
                Modul alokasi IP dan rentang IP address untuk pelanggan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ipModule">Modul IP</Label>
                <Select
                  value={watchedValues.ipModule}
                  onValueChange={(v) =>
                    setValue("ipModule", v as IpModuleType, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="ipModule" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sql">
                      SQL IP Module (FreeRADIUS IP Pool / Database)
                    </SelectItem>
                    <SelectItem value="mikrotik_pool">
                      Mikrotik IP Pool (Local IP Pool MikroTik)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Pilih cara pembagian IP address dinamis ke pelanggan.
                </p>
              </div>

              <div>
                <Label htmlFor="localAddress">
                  Local Address (Gateway PPP)
                </Label>
                <Input
                  id="localAddress"
                  placeholder="Contoh: 10.10.10.1"
                  {...register("localAddress")}
                  className="mt-1 font-mono text-sm"
                />
                {errors.localAddress && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.localAddress.message}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  IP Gateway router sisi server. Tidak boleh berada di dalam
                  rentang IP pool client.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="rangeIpStart">Range IP Start</Label>
                  <Input
                    id="rangeIpStart"
                    placeholder="Contoh: 10.10.10.2"
                    {...register("rangeIpStart")}
                    className="mt-1 font-mono text-sm"
                  />
                  {errors.rangeIpStart && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.rangeIpStart.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="rangeIpEnd">Range IP End</Label>
                  <Input
                    id="rangeIpEnd"
                    placeholder="Contoh: 10.10.10.254"
                    {...register("rangeIpEnd")}
                    className="mt-1 font-mono text-sm"
                  />
                  {errors.rangeIpEnd && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.rangeIpEnd.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: DNS & Queue Lanjutan */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-violet-600" />
                <CardTitle className="text-base">
                  DNS & Parameter RouterOS
                </CardTitle>
              </div>
              <CardDescription>
                DNS server yang dikirim ke pelanggan dan parent queue induk.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="dnsServers">
                  DNS Server (Pisahkan dengan koma)
                </Label>
                <Input
                  id="dnsServers"
                  placeholder="8.8.8.8,8.8.4.4"
                  {...register("dnsServers")}
                  className="mt-1 font-mono text-sm"
                />
                {errors.dnsServers && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors.dnsServers.message}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 mt-1">
                  Default: 8.8.8.8,8.8.4.4 (Google Public DNS) atau DNS lokal
                  ISP Anda.
                </p>
              </div>

              <div>
                <Label htmlFor="parentQueue">Parent Queue (Opsional)</Label>
                <Input
                  id="parentQueue"
                  placeholder="Contoh: Total-Traffic / PPP-Client-All"
                  {...register("parentQueue")}
                  className="mt-1"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Nama simple queue induk di RouterOS untuk manajemen hirarki
                  bandwidth.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Summary */}
        <div>
          <Card className="sticky top-6 border-emerald-100 bg-emerald-50/40 dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-base">
                  Ringkasan Network Group
                </CardTitle>
              </div>
              <CardDescription>
                Detail alokasi IP pool dan gateway grup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="space-y-2 text-slate-600 dark:text-slate-400">
                <div className="flex justify-between border-b border-emerald-200/50 pb-2 dark:border-emerald-800/50">
                  <span>Modul IP:</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {watchedValues.ipModule === "sql"
                      ? "SQL IP Module"
                      : "Mikrotik Pool"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-emerald-200/50 pb-2 dark:border-emerald-800/50">
                  <span>Local Gateway:</span>
                  <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                    {watchedValues.localAddress || "-"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 border-b border-emerald-200/50 pb-2 dark:border-emerald-800/50">
                  <span>Client IP Range:</span>
                  <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                    {watchedValues.rangeIpStart || "-"} s.d{" "}
                    {watchedValues.rangeIpEnd || "-"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span>DNS Server:</span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    {watchedValues.dnsServers || "-"}
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
