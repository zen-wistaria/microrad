"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Flame,
  Layers,
  Loader2,
  Network,
  Radio,
  Server,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Badge } from "@/components/ui/badge";
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
  useCreateProfileGroupMutation,
  usePppProfilesQuery,
  useRoutersQuery,
  useUpdateProfileGroupMutation,
} from "@/lib/api/hooks";
import type { AreaGroup } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

const areaGroupSchema = z.object({
  name: z.string().min(3, "Nama Wilayah (Area Group) minimal 3 karakter"),
  description: z.string().optional().nullable(),
});

type AreaGroupFormValues = z.infer<typeof areaGroupSchema>;

interface AreaGroupFormProps {
  initialData?: AreaGroup;
  isEditing?: boolean;
}

export function ProfileGroupForm({
  initialData,
  isEditing,
}: AreaGroupFormProps) {
  const router = useRouter();
  const createMutation = useCreateProfileGroupMutation();
  const updateMutation = useUpdateProfileGroupMutation();

  const { data: routersRes, isLoading: loadingRouters } = useRoutersQuery({
    limit: 100,
  });
  const allRouters = routersRes?.data || [];

  const { data: pppRes, isLoading: loadingPpp } = usePppProfilesQuery({
    limit: 1000,
  });
  const allProfiles = pppRes?.data || [];

  // Track selected Service Types: "PPP" | "HOTSPOT" (bisa multiple)
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<
    ("PPP" | "HOTSPOT")[]
  >(() => {
    if (initialData?.serviceType) {
      const types: ("PPP" | "HOTSPOT")[] = [];
      const stUpper = initialData.serviceType.toUpperCase();
      if (stUpper.includes("PPP")) types.push("PPP");
      if (stUpper.includes("HOTSPOT")) types.push("HOTSPOT");
      return types.length > 0 ? types : ["PPP"];
    }
    return ["PPP"];
  });

  // Track checked Router NAS IDs
  const [selectedNasIds, setSelectedNasIds] = useState<string[]>(() => {
    if (initialData?.routers) {
      return initialData.routers.map((r) => r.id);
    }
    return [];
  });

  // Track checked Profile IDs
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>(() => {
    if (initialData?.pppProfiles) {
      return initialData.pppProfiles.map((p) => p.id);
    }
    return [];
  });

  useEffect(() => {
    if (initialData?.serviceType) {
      const types: ("PPP" | "HOTSPOT")[] = [];
      const stUpper = initialData.serviceType.toUpperCase();
      if (stUpper.includes("PPP")) types.push("PPP");
      if (stUpper.includes("HOTSPOT")) types.push("HOTSPOT");
      if (types.length > 0) setSelectedServiceTypes(types);
    }
    if (initialData?.routers) {
      setSelectedNasIds(initialData.routers.map((r) => r.id));
    }
    if (initialData?.pppProfiles) {
      setSelectedProfileIds(initialData.pppProfiles.map((p) => p.id));
    }
  }, [initialData]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AreaGroupFormValues>({
    resolver: zodResolver(areaGroupSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
    },
  });

  const toggleServiceType = (type: "PPP" | "HOTSPOT") => {
    setSelectedServiceTypes((prev) => {
      let next: ("PPP" | "HOTSPOT")[];
      if (prev.includes(type)) {
        if (prev.length <= 1) {
          toast.warning("Minimal satu tipe layanan harus dipilih.");
          return prev;
        }
        next = prev.filter((t) => t !== type);
      } else {
        next = [...prev, type];
      }

      // Otomatis uncheck profil dari layanan yang tidak lagi dipilih
      setSelectedProfileIds((currentSelectedIds) => {
        return currentSelectedIds.filter((pId) => {
          const prof = allProfiles.find((p) => p.id === pId);
          if (!prof) return true;
          const pType = prof.serviceType === "HOTSPOT" ? "HOTSPOT" : "PPP";
          return next.includes(pType);
        });
      });

      return next;
    });
  };

  const toggleRouterNas = (id: string) => {
    setSelectedNasIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleProfile = (id: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const onSubmit = async (values: AreaGroupFormValues) => {
    try {
      if (selectedServiceTypes.length === 0) {
        toast.error("Pilih minimal satu tipe layanan (PPP atau Hotspot).");
        return;
      }

      const payload = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        serviceType: selectedServiceTypes.join(","),
        nasIds: selectedNasIds,
        pppProfileIds: selectedProfileIds,
      };

      if (isEditing && initialData) {
        const res = (await updateMutation.mutateAsync({
          id: initialData.id,
          data: payload,
        })) as { data?: { syncResults?: string[] } };

        const syncResults = res?.data?.syncResults || [];
        if (syncResults.length > 0) {
          const failures = syncResults.filter((m) =>
            m.toLowerCase().includes("gagal"),
          );
          if (failures.length > 0) {
            toast.warning(
              `Tersimpan, namun ada catatan sinkronisasi: ${failures.join("; ")}`,
            );
          } else {
            toast.success(
              `Wilayah (Area Group) diperbarui & ${syncResults.length} profil disinkronkan ke router.`,
            );
          }
        } else {
          toast.success("Wilayah (Area Group) berhasil diperbarui.");
        }
      } else {
        const res = (await createMutation.mutateAsync(payload)) as {
          data?: { syncResults?: string[] };
        };
        const syncResults = res?.data?.syncResults || [];
        if (syncResults.length > 0) {
          const failures = syncResults.filter((m) =>
            m.toLowerCase().includes("gagal"),
          );
          if (failures.length > 0) {
            toast.warning(
              `Dibuat, namun ada catatan sinkronisasi: ${failures.join("; ")}`,
            );
          } else {
            toast.success(
              `Wilayah (Area Group) dibuat & ${syncResults.length} profil diterapkan ke router.`,
            );
          }
        } else {
          toast.success("Wilayah (Area Group) baru berhasil dibuat.");
        }
      }
      router.push("/profile-groups");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const isPending =
    isSubmitting || createMutation.isPending || updateMutation.isPending;

  const filteredProfiles = allProfiles.filter((p) => {
    const profileService = p.serviceType === "HOTSPOT" ? "HOTSPOT" : "PPP";
    return selectedServiceTypes.includes(profileService);
  });

  const selectAllProfiles = () => {
    const profileIdsToAdd = filteredProfiles.map((p) => p.id);
    setSelectedProfileIds((prev) =>
      Array.from(new Set([...prev, ...profileIdsToAdd])),
    );
  };

  const clearProfiles = () => {
    const profileIdsToRemove = new Set(filteredProfiles.map((p) => p.id));
    setSelectedProfileIds((prev) =>
      prev.filter((id) => !profileIdsToRemove.has(id)),
    );
  };

  const serviceTypeLabel = selectedServiceTypes.join(" & ");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/profile-groups">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isEditing
                ? "Edit Wilayah (Area Group)"
                : "Tambah Wilayah (Area Group)"}
            </h1>
            <p className="text-xs text-slate-500">
              {isEditing
                ? "Perbarui konfigurasi multi-router NAS, profil layanan, dan zona failover"
                : "Pilih router NAS dan profil layanan untuk auto-apply ke router"}
            </p>
          </div>
        </div>
      </div>

      {/* Card 1: Informasi Wilayah & Service Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4 text-blue-600" />
            Informasi Wilayah & Layanan
          </CardTitle>
          <CardDescription>
            Beri nama wilayah coverage dan tentukan tipe layanan yang aktif.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Wilayah (Area Group) *</Label>
            <Input
              id="name"
              placeholder="Contoh: Area Kota Sentral, Wilayah Timur, Cluster Hotspot A"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-rose-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Tipe Layanan Aktif (Bisa Pilih Lebih dari Satu) *</Label>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => toggleServiceType("PPP")}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  selectedServiceTypes.includes("PPP")
                    ? "border-blue-500 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-950/30 ring-1 ring-blue-500"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 opacity-70"
                }`}
              >
                <div className="pt-0.5">
                  <Checkbox
                    checked={selectedServiceTypes.includes("PPP")}
                    onCheckedChange={() => toggleServiceType("PPP")}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Radio className="h-4 w-4 text-blue-600 shrink-0" />
                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      PPP / PPPoE
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Koneksi broadband rumahan & dial-in tunnel
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => toggleServiceType("HOTSPOT")}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  selectedServiceTypes.includes("HOTSPOT")
                    ? "border-amber-500 bg-amber-50/50 dark:border-amber-600 dark:bg-amber-950/30 ring-1 ring-amber-500"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 opacity-70"
                }`}
              >
                <div className="pt-0.5">
                  <Checkbox
                    checked={selectedServiceTypes.includes("HOTSPOT")}
                    onCheckedChange={() => toggleServiceType("HOTSPOT")}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-amber-500 shrink-0" />
                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      Hotspot
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Layanan captive portal & voucher hotspot
                  </p>
                </div>
              </button>
            </div>
            {selectedServiceTypes.length === 0 && (
              <p className="text-xs text-rose-500">
                Pilih minimal satu tipe layanan (PPP atau Hotspot).
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Keterangan / Catatan Area</Label>
            <textarea
              id="description"
              placeholder="Coverage wilayah, penanggung jawab NOC, lokasi node..."
              rows={2}
              className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-slate-400 focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-slate-950 dark:border-slate-800"
              {...register("description")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 2: Pemilihan Multi-Router NAS */}
        <Card className="h-full flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="h-4 w-4 text-indigo-600" />
                  Pilih Router NAS di Wilayah Ini
                </CardTitle>
                <CardDescription>
                  Pilih router node yang melayani wilayah ini untuk failover.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setSelectedNasIds(allRouters.map((r) => r.id))}
                >
                  Pilih Semua
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-slate-500"
                  onClick={() => setSelectedNasIds([])}
                >
                  Bersihkan
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {loadingRouters ? (
              <div className="space-y-2 py-2">
                <div className="h-12 w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
                <div className="h-12 w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
              </div>
            ) : allRouters.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-lg text-slate-500 text-xs">
                Belum ada Router NAS terdaftar. Tambahkan Router di menu Router
                terlebih dahulu.
              </div>
            ) : (
              <div className="grid gap-2.5">
                {allRouters.map((r) => {
                  const isChecked = selectedNasIds.includes(r.id);
                  return (
                    <label
                      key={r.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? "border-indigo-500 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-950/20"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRouterNas(r.id)}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {r.name}
                          </p>
                          <Badge
                            variant={
                              r.status === "online" ? "default" : "secondary"
                            }
                            className={`text-[10px] ${
                              r.status === "online"
                                ? "bg-emerald-500 text-white"
                                : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {r.status || "unknown"}
                          </Badge>
                        </div>
                        <p className="font-mono text-xs text-slate-500 truncate mt-0.5">
                          {r.ipAddress}
                        </p>
                        {r.location && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {r.location}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Profil yang ingin di-apply */}
        <Card className="h-full flex flex-col">
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-600" />
                  Profil Layanan ({serviceTypeLabel})
                </CardTitle>
                <CardDescription>
                  Profil terpilih otomatis dibuatkan di router target.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={selectAllProfiles}
                  disabled={filteredProfiles.length === 0}
                >
                  Pilih Semua
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 text-slate-500"
                  onClick={clearProfiles}
                  disabled={filteredProfiles.length === 0}
                >
                  Bersihkan
                </Button>
                <Link
                  href="/profiles/new"
                  className="text-xs text-blue-600 hover:underline ml-1"
                >
                  + Buat Profil
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            {loadingPpp ? (
              <div className="space-y-2 py-2">
                <div className="h-12 w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
                <div className="h-12 w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="p-6 text-center border border-dashed rounded-lg text-slate-500 text-xs space-y-2">
                <p>
                  Belum ada Profil dengan tipe layanan{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {serviceTypeLabel}
                  </span>
                  .
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/profiles/new">+ Buat Profil Baru</Link>
                </Button>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {filteredProfiles.map((p) => {
                  const isChecked = selectedProfileIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? "border-emerald-500 bg-emerald-50/40 dark:border-emerald-700 dark:bg-emerald-950/20"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProfile(p.id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                              {p.name}
                            </p>
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-mono ${
                                p.serviceType === "HOTSPOT"
                                  ? "border-amber-300 text-amber-700 dark:text-amber-300"
                                  : "border-blue-300 text-blue-700 dark:text-blue-300"
                              }`}
                            >
                              {p.serviceType || "PPP"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                            <span className="font-mono">
                              Modul:{" "}
                              {p.ipModule === "sql"
                                ? "SQL IP Pool"
                                : "MikroTik Pool"}
                            </span>
                            {p.localAddress && (
                              <>
                                <span>•</span>
                                <span className="font-mono">
                                  GW: {p.localAddress}
                                </span>
                              </>
                            )}
                            {p.rangeIpStart && p.rangeIpEnd && (
                              <>
                                <span>•</span>
                                <span className="font-mono">
                                  Pool: {p.rangeIpStart} - {p.rangeIpEnd}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {isChecked && (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 text-[11px]"
                        >
                          Terapkan
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" type="button" asChild>
          <Link href="/profile-groups">Batal</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isEditing ? "Simpan Perubahan & Sync" : "Terapkan & Buat Wilayah"}
        </Button>
      </div>
    </form>
  );
}
