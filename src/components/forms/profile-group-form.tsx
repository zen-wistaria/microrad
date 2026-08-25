"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  Loader2,
  Network,
  Radio,
  Router as RouterIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useCreateProfileGroupMutation,
  usePppProfilesQuery,
  useUpdateProfileGroupMutation,
} from "@/lib/api/hooks";
import type { ProfileGroup } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

const profileGroupSchema = z.object({
  name: z.string().min(3, "Nama Profile Group minimal 3 karakter"),
  description: z.string().optional().nullable(),
});

type ProfileGroupFormValues = z.infer<typeof profileGroupSchema>;

interface ProfileGroupFormProps {
  initialData?: ProfileGroup;
  isEditing?: boolean;
}

export function ProfileGroupForm({
  initialData,
  isEditing,
}: ProfileGroupFormProps) {
  const router = useRouter();
  const createMutation = useCreateProfileGroupMutation();
  const updateMutation = useUpdateProfileGroupMutation();

  const { data: pppRes, isLoading: loadingPpp } = usePppProfilesQuery({
    limit: 1000,
  });
  const allPppProfiles = pppRes?.data || [];

  // Track checked PPP profiles
  const [selectedPppIds, setSelectedPppIds] = useState<string[]>(() => {
    if (initialData?.pppProfiles) {
      return initialData.pppProfiles.map((p) => p.id);
    }
    return [];
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileGroupFormValues>({
    resolver: zodResolver(profileGroupSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
    },
  });

  const togglePppProfile = (id: string) => {
    setSelectedPppIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const onSubmit = async (values: ProfileGroupFormValues) => {
    try {
      const payload = {
        ...values,
        description: values.description?.trim() || null,
        pppProfileIds: selectedPppIds,
      };

      if (isEditing && initialData) {
        await updateMutation.mutateAsync({
          id: initialData.id,
          data: payload,
        });
        toast.success("Profile Group (Wilayah) berhasil diperbarui.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Profile Group (Wilayah) baru berhasil ditambahkan.");
      }
      router.push("/profile-groups");
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
            <Link href="/profile-groups">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isEditing ? "Edit Profile Group" : "Tambah Profile Group"}
            </h1>
            <p className="text-xs text-slate-500">
              {isEditing
                ? "Perbarui pengelompokan router/node dalam wilayah failover"
                : "Buat pengelompokan wilayah untuk multi-router failover"}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4 text-blue-600" />
            Informasi Wilayah / Area
          </CardTitle>
          <CardDescription>
            Beri nama wilayah/area operasional ISP Anda.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Profile Group (Wilayah) *</Label>
            <Input
              id="name"
              placeholder="Contoh: Wilayah Kota A, Area Barat, Node Sentral"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-rose-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Keterangan / Catatan Area</Label>
            <textarea
              id="description"
              placeholder="Catatan coverage area, penanggung jawab NOC, dsb."
              rows={3}
              {...register("description")}
              className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 dark:border-slate-800 dark:placeholder:text-slate-500 dark:focus-visible:ring-slate-300"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-600" />
                PPP Profile Node yang Tergabung
              </CardTitle>
              <CardDescription>
                Pilih Router NAS / PPP Profile mana saja yang masuk ke dalam
                grup wilayah ini.
              </CardDescription>
            </div>
            <Link
              href="/ppp-profiles/new"
              className="text-xs text-blue-600 hover:underline"
            >
              + Buat PPP Profile Baru
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPpp ? (
            <div className="space-y-2 py-2">
              <div className="h-12 w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
              <div className="h-12 w-full bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
            </div>
          ) : allPppProfiles.length === 0 ? (
            <div className="p-6 text-center border border-dashed rounded-lg text-slate-500 text-xs">
              Belum ada PPP Profile yang dibuat. Silakan tambahkan PPP Profile
              terlebih dahulu.
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-[11px] text-slate-500 mb-2">
                Pelanggan di wilayah ini akan otomatis diizinkan dial ke seluruh
                router yang dicentang di bawah (Zero-Touch Failover):
              </p>
              <div className="grid gap-2.5">
                {allPppProfiles.map((p) => {
                  const isChecked = selectedPppIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? "border-blue-500 bg-blue-50/40 dark:border-blue-700 dark:bg-blue-950/20"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePppProfile(p.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            {p.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                              <RouterIcon className="h-3 w-3 text-indigo-500" />
                              {p.nasRouter?.name || p.nasId}
                            </span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">
                              GW: {p.localAddress}
                            </span>
                            <span>•</span>
                            <span className="font-mono text-slate-500">
                              Pool: {p.rangeIpStart} - {p.rangeIpEnd}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isChecked && (
                        <Badge
                          variant="secondary"
                          className="bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-[11px]"
                        >
                          Tergabung
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" type="button" asChild>
          <Link href="/profile-groups">Batal</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {isEditing ? "Simpan Perubahan" : "Buat Profile Group"}
        </Button>
      </div>
    </form>
  );
}
