"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Network, Radio } from "lucide-react";
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
  useCreatePppProfileMutation,
  useProfileGroupsQuery,
  useRoutersQuery,
  useUpdatePppProfileMutation,
} from "@/lib/api/hooks";
import type {
  IpModuleType,
  NasRouter,
  PppProfile,
  ProfileGroup,
} from "@/lib/types";
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

const pppProfileSchema = z
  .object({
    name: z.string().min(3, "Nama PPP Profile minimal 3 karakter"),
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
    profileGroupId: z.string().optional().nullable(),
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

    if (
      localNum > 0 &&
      startNum > 0 &&
      endNum > 0 &&
      localNum >= startNum &&
      localNum <= endNum
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["localAddress"],
        message: `Local Address Gateway (${data.localAddress}) tidak boleh berada di antara Range IP (${data.rangeIpStart} - ${data.rangeIpEnd})`,
      });
    }
  });

type PppProfileFormValues = z.infer<typeof pppProfileSchema>;

interface PppProfileFormProps {
  initialData?: PppProfile;
  isEditing?: boolean;
}

export function PppProfileForm({
  initialData,
  isEditing,
}: PppProfileFormProps) {
  const router = useRouter();
  const createMutation = useCreatePppProfileMutation();
  const updateMutation = useUpdatePppProfileMutation();

  const { data: routersRes, isLoading: loadingRouters } = useRoutersQuery();
  const { data: groupsRes, isLoading: loadingGroups } = useProfileGroupsQuery();
  const routers: NasRouter[] = routersRes || [];
  const groups: ProfileGroup[] = groupsRes?.data || [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PppProfileFormValues>({
    resolver: zodResolver(pppProfileSchema),
    defaultValues: {
      name: initialData?.name || "",
      nasId: initialData?.nasId || "",
      type: "PPP",
      ipModule: initialData?.ipModule || "sql",
      localAddress: initialData?.localAddress || "10.10.10.1",
      rangeIpStart: initialData?.rangeIpStart || "10.10.10.2",
      rangeIpEnd: initialData?.rangeIpEnd || "10.10.10.254",
      dnsServers: initialData?.dnsServers || "8.8.8.8,8.8.4.4",
      parentQueue: initialData?.parentQueue || "",
      profileGroupId: initialData?.profileGroupId || "",
    },
  });

  const selectedNasId = watch("nasId");
  const selectedIpModule = watch("ipModule");
  const selectedGroupId = watch("profileGroupId");

  const onSubmit = async (values: PppProfileFormValues) => {
    try {
      const payload = {
        ...values,
        parentQueue: values.parentQueue?.trim() || null,
        profileGroupId: values.profileGroupId?.trim() || null,
      };

      if (isEditing && initialData) {
        await updateMutation.mutateAsync({
          id: initialData.id,
          data: payload,
        });
        toast.success("PPP Profile berhasil diperbarui.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("PPP Profile baru berhasil ditambahkan.");
      }
      router.push("/ppp-profiles");
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
            <Link href="/ppp-profiles">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isEditing ? "Edit PPP Profile" : "Tambah PPP Profile"}
            </h1>
            <p className="text-xs text-slate-500">
              {isEditing
                ? "Perbarui konfigurasi gateway & pool node Router MikroTik"
                : "Konfigurasikan gateway PPP, IP pool, dan DNS untuk node Router MikroTik"}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Radio className="h-4 w-4 text-blue-600" />
            Informasi PPP Profile Node
          </CardTitle>
          <CardDescription>
            Tentukan nama profile di MikroTik dan router NAS target.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Profile di MikroTik *</Label>
            <Input
              id="name"
              placeholder="Contoh: pppoe-node-a1, default-encryption"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-rose-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="nasId">Router NAS Target *</Label>
              <Link
                href="/routers"
                className="text-xs text-blue-600 hover:underline"
              >
                + Kelola Router
              </Link>
            </div>
            <Select
              value={selectedNasId}
              onValueChange={(val) =>
                setValue("nasId", val, { shouldValidate: true })
              }
              disabled={loadingRouters}
            >
              <SelectTrigger id="nasId">
                <SelectValue placeholder="-- Pilih Router NAS --" />
              </SelectTrigger>
              <SelectContent>
                {routers.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} ({r.ipAddress})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.nasId && (
              <p className="text-xs text-rose-500">{errors.nasId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="profileGroupId">
                Profile Group / Wilayah (Opsional)
              </Label>
              <Link
                href="/profile-groups"
                className="text-xs text-blue-600 hover:underline"
              >
                + Kelola Wilayah
              </Link>
            </div>
            <Select
              value={selectedGroupId || "none"}
              onValueChange={(val) =>
                setValue("profileGroupId", val === "none" ? null : val, {
                  shouldValidate: true,
                })
              }
              disabled={loadingGroups}
            >
              <SelectTrigger id="profileGroupId">
                <SelectValue placeholder="-- Belum dimasukkan ke Wilayah --" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  -- Tanpa Group / Mandiri --
                </SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400">
              Mengelompokkan node ini ke dalam zona failover wilayah tertentu.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4 text-emerald-600" />
            Alokasi IP & Jaringan PPP
          </CardTitle>
          <CardDescription>
            Konfigurasi Local Gateway, Rentang Pool Client, DNS Server, dan
            Parent Queue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="type">Tipe Layanan</Label>
              <Select
                value="PPP"
                onValueChange={(val) =>
                  setValue("type", val as "PPP", { shouldValidate: true })
                }
              >
                <SelectTrigger id="type">
                  <SelectValue placeholder="Pilih Tipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PPP">PPP (PPPoE / L2TP / SSTP)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ipModule">IP Module Allocation *</Label>
              <Select
                value={selectedIpModule}
                onValueChange={(val) =>
                  setValue("ipModule", val as IpModuleType, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="ipModule">
                  <SelectValue placeholder="Pilih IP Module" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sql">
                    SQL IP Module (FreeRADIUS IP Pool)
                  </SelectItem>
                  <SelectItem value="mikrotik_pool">
                    MikroTik IP Pool (Local Router Pool)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="localAddress">Local Address (PPP Gateway) *</Label>
            <Input
              id="localAddress"
              placeholder="10.10.10.1"
              {...register("localAddress")}
            />
            <p className="text-[11px] text-slate-400">
              IP Gateway lokal interface PPP di sisi RouterOS.
            </p>
            {errors.localAddress && (
              <p className="text-xs text-rose-500">
                {errors.localAddress.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rangeIpStart">Range IP Pool (Awal) *</Label>
              <Input
                id="rangeIpStart"
                placeholder="10.10.10.2"
                {...register("rangeIpStart")}
              />
              {errors.rangeIpStart && (
                <p className="text-xs text-rose-500">
                  {errors.rangeIpStart.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rangeIpEnd">Range IP Pool (Akhir) *</Label>
              <Input
                id="rangeIpEnd"
                placeholder="10.10.10.254"
                {...register("rangeIpEnd")}
              />
              {errors.rangeIpEnd && (
                <p className="text-xs text-rose-500">
                  {errors.rangeIpEnd.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dnsServers">DNS Server (Pisahkan Koma) *</Label>
            <Input
              id="dnsServers"
              placeholder="8.8.8.8,8.8.4.4"
              {...register("dnsServers")}
            />
            {errors.dnsServers && (
              <p className="text-xs text-rose-500">
                {errors.dnsServers.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="parentQueue">
              Parent Queue di RouterOS (Opsional)
            </Label>
            <Input
              id="parentQueue"
              placeholder="Contoh: TOTAL-CLIENT, PARENT-PPPOE"
              {...register("parentQueue")}
            />
            <p className="text-[11px] text-slate-400">
              Menghubungkan dynamic queue PPPoE ke antrean induk (Simple Queue).
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" type="button" asChild>
          <Link href="/ppp-profiles">Batal</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isEditing ? "Simpan Perubahan" : "Buat PPP Profile"}
        </Button>
      </div>
    </form>
  );
}
