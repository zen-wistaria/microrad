"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Clock,
  Cookie,
  Flame,
  Loader2,
  Network,
  Radio,
  Sliders,
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
import { Checkbox } from "@/components/ui/checkbox";
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
  useCreateProfileMutation,
  useProfileGroupsQuery,
  useUpdateProfileMutation,
} from "@/lib/api/hooks";
import type {
  AreaGroup,
  IpModuleType,
  PppProfile,
  ServiceType,
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

const profileSchema = z
  .object({
    name: z.string().min(3, "Nama Profile minimal 3 karakter"),
    serviceType: z.enum(["PPP", "HOTSPOT"]),
    areaGroupId: z.string().optional().nullable(),
    ipModule: z.enum(["sql", "mikrotik_pool"]),
    localAddress: z
      .string()
      .optional()
      .nullable()
      .refine(
        (val) => !val || ipv4Regex.test(val),
        "Format Local Address (IPv4) tidak valid (contoh: 10.10.10.1)",
      ),
    rangeIpStart: z
      .string()
      .optional()
      .nullable()
      .refine(
        (val) => !val || ipv4Regex.test(val),
        "Format Range IP Start (IPv4) tidak valid (contoh: 10.10.10.2)",
      ),
    rangeIpEnd: z
      .string()
      .optional()
      .nullable()
      .refine(
        (val) => !val || ipv4Regex.test(val),
        "Format Range IP End (IPv4) tidak valid (contoh: 10.10.10.254)",
      ),
    dnsServers: z
      .string()
      .min(1, "DNS Server wajib diisi (contoh: 8.8.8.8,8.8.4.4)"),
    parentQueue: z.string().optional().nullable(),
    sessionTimeout: z.number().optional().nullable(),
    idleTimeout: z.number().optional().nullable(),
    insertQueueBefore: z.string().optional().nullable(),
    keepaliveTimeout: z.string().optional().nullable(),
    addMacCookie: z.boolean(),
    macCookieTimeout: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    // Untuk PPP Profile, localAddress wajib diisi
    if (data.serviceType === "PPP" && !data.localAddress?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Local Address Gateway wajib diisi untuk profil PPP/PPPoE.",
        path: ["localAddress"],
      });
    }

    if (data.localAddress && data.rangeIpStart && data.rangeIpEnd) {
      const localNum = ipToNumber(data.localAddress);
      const startNum = ipToNumber(data.rangeIpStart);
      const endNum = ipToNumber(data.rangeIpEnd);

      if (startNum > endNum) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Range IP Start tidak boleh lebih besar dari Range IP End.",
          path: ["rangeIpStart"],
        });
      }

      if (localNum >= startNum && localNum <= endNum) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Local Address tidak boleh berada di dalam rentang alokasi pool IP client.",
          path: ["localAddress"],
        });
      }
    }

    // Jika fitur MAC Cookie aktif, macCookieTimeout wajib diisi
    if (
      data.serviceType === "HOTSPOT" &&
      data.addMacCookie &&
      !data.macCookieTimeout?.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "MAC Cookie Timeout wajib diisi saat fitur MAC Cookie aktif (misal: 3d).",
        path: ["macCookieTimeout"],
      });
    }
  });

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  initialData?: PppProfile;
  isEditing?: boolean;
}

export function ProfileForm({ initialData, isEditing }: ProfileFormProps) {
  const router = useRouter();
  const createMutation = useCreateProfileMutation();
  const updateMutation = useUpdateProfileMutation();

  const { data: groupsRes, isLoading: loadingGroups } = useProfileGroupsQuery({
    limit: 100,
  });
  const groups = (groupsRes?.data || []) as AreaGroup[];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: initialData?.name || "",
      serviceType: initialData?.serviceType === "HOTSPOT" ? "HOTSPOT" : "PPP",
      areaGroupId: initialData?.areaGroupId || null,
      ipModule: (initialData?.ipModule as IpModuleType) || "sql",
      localAddress: initialData?.localAddress || "",
      rangeIpStart: initialData?.rangeIpStart || "",
      rangeIpEnd: initialData?.rangeIpEnd || "",
      dnsServers: initialData?.dnsServers || "8.8.8.8,8.8.4.4",
      parentQueue: initialData?.parentQueue || "",
      sessionTimeout: initialData?.sessionTimeout ?? null,
      idleTimeout: initialData?.idleTimeout ?? null,
      insertQueueBefore: initialData?.insertQueueBefore || null,
      keepaliveTimeout: initialData?.keepaliveTimeout || "",
      addMacCookie: initialData?.addMacCookie || false,
      macCookieTimeout: initialData?.macCookieTimeout || "",
    },
  });

  const selectedServiceType = watch("serviceType");
  const selectedIpModule = watch("ipModule");
  const selectedGroupId = watch("areaGroupId");
  const parentQueueVal = watch("parentQueue");
  const addMacCookieVal = watch("addMacCookie");
  const insertQueueBeforeVal = watch("insertQueueBefore");

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      const payload = {
        ...values,
        localAddress: values.localAddress?.trim() || null,
        rangeIpStart: values.rangeIpStart?.trim() || null,
        rangeIpEnd: values.rangeIpEnd?.trim() || null,
        parentQueue: values.parentQueue?.trim() || null,
        insertQueueBefore: values.insertQueueBefore?.trim() || null,
        keepaliveTimeout: values.keepaliveTimeout?.trim() || null,
        macCookieTimeout: values.macCookieTimeout?.trim() || null,
        areaGroupId: values.areaGroupId?.trim() || null,
        profileGroupId: values.areaGroupId?.trim() || null,
      };

      if (isEditing && initialData) {
        const res = (await updateMutation.mutateAsync({
          id: initialData.id,
          data: payload,
        })) as { data?: { syncResults?: string[] } };

        const syncResults = res?.data?.syncResults || [];
        if (syncResults.length > 0) {
          const failures = syncResults.filter(
            (m) =>
              m.toLowerCase().includes("gagal") ||
              m.toLowerCase().includes("offline") ||
              m.toLowerCase().includes("timeout"),
          );
          if (failures.length > 0) {
            toast.warning(
              `Profil ${values.serviceType} diperbarui, namun ada catatan: ${failures.join("; ")}`,
            );
          } else {
            toast.success(
              `Profil ${values.serviceType} diperbarui & disinkronkan ke router NAS.`,
            );
          }
        } else {
          toast.success(`Profil ${values.serviceType} berhasil diperbarui.`);
        }
      } else {
        const res = (await createMutation.mutateAsync(payload)) as {
          data?: { syncResults?: string[] };
        };
        const syncResults = res?.data?.syncResults || [];
        if (syncResults.length > 0) {
          const failures = syncResults.filter(
            (m) =>
              m.toLowerCase().includes("gagal") ||
              m.toLowerCase().includes("offline") ||
              m.toLowerCase().includes("timeout"),
          );
          if (failures.length > 0) {
            toast.warning(
              `Profil ${values.serviceType} dibuat, namun ada catatan: ${failures.join("; ")}`,
            );
          } else {
            toast.success(
              `Profil ${values.serviceType} baru dibuat & diterapkan ke router NAS.`,
            );
          }
        } else {
          toast.success(`Profil ${values.serviceType} baru berhasil dibuat.`);
        }
      }
      router.push("/profiles");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isPending =
    isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/profiles">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isEditing ? "Edit Profil Layanan" : "Tambah Profil Layanan"}
            </h1>
            <p className="text-xs text-slate-500">
              {isEditing
                ? "Perbarui konfigurasi gateway, IP pool, timeout, dan queue"
                : "Konfigurasikan gateway, IP pool, DNS, timeout, dan queue untuk PPP/Hotspot"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Kolom Kiri: Identitas Profil & Timeout / Queue */}
        <div className="space-y-6">
          {/* Card 1: Identitas Profil & Wilayah */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="h-4 w-4 text-blue-600" />
                Identitas Profil & Wilayah Layanan
              </CardTitle>
              <CardDescription>
                Tentukan nama profil di RouterOS, tipe layanan, dan wilayah
                (Area Group).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nama Profil di RouterOS *</Label>
                <Input
                  id="name"
                  placeholder="Contoh: profile-node-a1, hotspot-vip"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-xs text-rose-500">{errors.name.message}</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Tipe Layanan (Service Type) *</Label>
                  <Select
                    value={selectedServiceType}
                    onValueChange={(val) =>
                      setValue("serviceType", val as ServiceType, {
                        shouldValidate: true,
                      })
                    }
                  >
                    <SelectTrigger id="serviceType">
                      <SelectValue placeholder="Pilih Tipe Layanan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PPP">
                        <div className="flex items-center gap-2">
                          <Radio className="h-4 w-4 text-blue-500" />
                          <span>PPP (PPPoE / Tunnel)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="HOTSPOT">
                        <div className="flex items-center gap-2">
                          <Flame className="h-4 w-4 text-amber-500" />
                          <span>Hotspot (Captive Portal)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="areaGroupId">Wilayah (Area Group)</Label>
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
                      setValue("areaGroupId", val === "none" ? null : val, {
                        shouldValidate: true,
                      })
                    }
                    disabled={loadingGroups}
                  >
                    <SelectTrigger id="areaGroupId">
                      <SelectValue placeholder="-- Pilih Wilayah --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        -- Bebas / Tanpa Wilayah --
                      </SelectItem>
                      {groups
                        .filter((g) =>
                          g.serviceType
                            ?.toUpperCase()
                            .includes(selectedServiceType.toUpperCase()),
                        )
                        .map((g) => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name} ({g.serviceType})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-400">
                    Otomatis di-apply ke router di area terpilih.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Session & Idle Timeouts + Parent Queue */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-600" />
                Pengaturan Timeout & Queue
              </CardTitle>
              <CardDescription>
                Atur batas waktu sesi, idle timeout, dan integrasi parent queue
                RouterOS.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="sessionTimeout">
                    Session Timeout (Detik, Opsional)
                  </Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    placeholder="Misal: 86400 (24 jam)"
                    {...register("sessionTimeout", {
                      setValueAs: (v) =>
                        v === "" || v === null || Number.isNaN(Number(v))
                          ? null
                          : Number(v),
                    })}
                  />
                  <p className="text-[11px] text-slate-400">
                    Maksimal durasi sesi aktif sebelum re-otentikasi.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="idleTimeout">
                    Idle Timeout (Detik, Opsional)
                  </Label>
                  <Input
                    id="idleTimeout"
                    type="number"
                    placeholder="Misal: 300 (5 menit)"
                    {...register("idleTimeout", {
                      setValueAs: (v) =>
                        v === "" || v === null || Number.isNaN(Number(v))
                          ? null
                          : Number(v),
                    })}
                  />
                  <p className="text-[11px] text-slate-400">
                    Putus koneksi otomatis jika idle tanpa trafik.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
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
                    Nama induk Simple Queue di RouterOS.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="insertQueueBefore">
                    Insert Queue Position (RouterOS)
                  </Label>
                  <Select
                    value={insertQueueBeforeVal || "none"}
                    onValueChange={(val) =>
                      setValue(
                        "insertQueueBefore",
                        val === "none" ? null : val,
                        {
                          shouldValidate: true,
                        },
                      )
                    }
                    disabled={!parentQueueVal?.trim()}
                  >
                    <SelectTrigger id="insertQueueBefore">
                      <SelectValue placeholder="-- Posisi Antrean --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        -- Default (Bawaan RouterOS) --
                      </SelectItem>
                      <SelectItem value="first">First (Paling Atas)</SelectItem>
                      <SelectItem value="bottom">
                        Bottom (Paling Bawah)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {!parentQueueVal?.trim() ? (
                    <p className="text-[11px] text-slate-400">
                      * Isi Parent Queue terlebih dahulu.
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-400">
                      Posisi dynamic queue di daftar Simple Queue.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan: Alokasi IP & Jaringan + Fitur Hotspot */}
        <div className="space-y-6">
          {/* Card 2: IP Module & Network Allocation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="h-4 w-4 text-emerald-600" />
                Alokasi IP & Jaringan
              </CardTitle>
              <CardDescription>
                Konfigurasi modul IP, Local Gateway, Rentang Pool Client, dan
                DNS Server.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                      SQL IP Module (FreeRADIUS IP Pool Pusat)
                    </SelectItem>
                    <SelectItem value="mikrotik_pool">
                      MikroTik IP Pool (Private Pool di Router MikroTik)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400">
                  {selectedIpModule === "mikrotik_pool"
                    ? "Aplikasi otomatis membuat /ip/pool di Router MikroTik."
                    : "IP dialokasikan secara terpusat oleh FreeRADIUS (sqlippool)."}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="localAddress">
                  Local Address Gateway (IPv4){" "}
                  {selectedServiceType === "PPP" && "*"}
                </Label>
                <Input
                  id="localAddress"
                  placeholder="10.10.10.1"
                  {...register("localAddress")}
                />
                <p className="text-[11px] text-slate-400">
                  IP Gateway interface lokal di sisi RouterOS.
                </p>
                {errors.localAddress && (
                  <p className="text-xs text-rose-500">
                    {errors.localAddress.message}
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rangeIpStart">Range IP Pool (Awal)</Label>
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
                  <Label htmlFor="rangeIpEnd">Range IP Pool (Akhir)</Label>
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
            </CardContent>
          </Card>

          {/* Card 4: Fitur Khusus Hotspot (Hanya tampil jika serviceType === "HOTSPOT") */}
          {selectedServiceType === "HOTSPOT" && (
            <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/20 dark:bg-amber-950/10">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-amber-900 dark:text-amber-300">
                  <Sliders className="h-4 w-4 text-amber-600" />
                  Fitur Khusus Hotspot (Captive Portal)
                </CardTitle>
                <CardDescription>
                  Pengaturan keepalive timeout dan MAC Cookie.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="keepaliveTimeout">Keepalive Timeout</Label>
                  <Input
                    id="keepaliveTimeout"
                    placeholder="Contoh: 2m, 5m, 10m"
                    {...register("keepaliveTimeout")}
                  />
                  <p className="text-[11px] text-slate-400">
                    Interval ping keepalive RouterOS ke client hotspot.
                  </p>
                </div>

                <div className="p-3 border rounded-lg bg-white dark:bg-slate-900 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="addMacCookie"
                      checked={addMacCookieVal}
                      onCheckedChange={(checked) =>
                        setValue("addMacCookie", Boolean(checked))
                      }
                    />
                    <label
                      htmlFor="addMacCookie"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Cookie className="h-4 w-4 text-amber-600" />
                      Aktifkan MAC Cookie (Auto-Login MAC Address)
                    </label>
                  </div>

                  {addMacCookieVal && (
                    <div className="space-y-1.5 pl-6">
                      <Label htmlFor="macCookieTimeout">
                        MAC Cookie Timeout
                      </Label>
                      <Input
                        id="macCookieTimeout"
                        placeholder="Contoh: 3d, 7d, 30d"
                        {...register("macCookieTimeout")}
                      />
                      <p className="text-[11px] text-slate-400">
                        Masa berlaku cookie sebelum login ulang (e.g. 3d = 3
                        hari).
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" type="button" asChild>
          <Link href="/profiles">Batal</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isEditing ? "Simpan Perubahan" : "Buat Profil Layanan"}
        </Button>
      </div>
    </form>
  );
}

// Alias for backward compatibility
export const PppProfileForm = ProfileForm;
