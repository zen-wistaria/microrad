"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CheckCircle,
  CircleX,
  FolderKanban,
  Loader2,
  ShieldUser,
  UserCheck,
  UserCog2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import { getRoles } from "@/lib/api/roles";
import { createUser, updateUser } from "@/lib/api/users";
import type { AppUser, AppUserRole, AppUserStatus, Role } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

const appUserSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Format email tidak valid"),
  role: z.enum(["admin", "manager", "operator", "customer"]),
  roleId: z.string().optional(),
  status: z.enum(["active", "disabled"]),
});

type AppUserFormValues = z.infer<typeof appUserSchema>;

interface AppUserFormProps {
  initialData?: AppUser;
  isEditing?: boolean;
}

export function AppUserForm({
  initialData,
  isEditing = false,
}: AppUserFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Kumpulan role yang dapat dipilih — dari API (server)
  const [allRoles, setAllRoles] = useState<Role[]>([]);

  useEffect(() => {
    getRoles()
      .then((roles) => setAllRoles(roles))
      .catch(() => {
        // fallback ke role bawaan
      });
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AppUserFormValues>({
    resolver: zodResolver(appUserSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      role: initialData?.role || "operator",
      roleId: initialData?.roleId || "role-manager",
      status: initialData?.status || "active",
    },
  });

  const selectedRoleId = watch("roleId");
  const selectedStatus = watch("status");

  const handleRoleChange = (val: string) => {
    setValue("roleId", val, { shouldValidate: true });
    const role = allRoles.find((r) => r.id === val);
    const legacy =
      role?.id === "role-admin" ? "admin" : ("operator" as AppUserRole);
    setValue("role", legacy, { shouldValidate: true });
  };

  const onSubmit = async (data: AppUserFormValues) => {
    try {
      setSubmitting(true);
      const payload = {
        name: data.name,
        email: data.email,
        role: data.role as AppUserRole,
        roleId: data.roleId as string,
        status: data.status as AppUserStatus,
      };
      if (isEditing && initialData) {
        await updateUser(initialData.id, payload);
        toast.success(`Pengguna ${data.name} berhasil diperbarui.`);
      } else {
        await createUser(payload);
        toast.success(`Pengguna ${data.name} berhasil ditambahkan.`);
      }
      router.push("/users");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menyimpan pengguna aplikasi.");
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
          <Link href="/users">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Pengguna Aplikasi
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <UserCheck className="h-5 w-5" />
            <CardTitle className="text-base">
              {isEditing ? "Edit Pengguna Dashboard" : "Tambah Pengguna Baru"}
            </CardTitle>
          </div>
          <CardDescription>
            Akun pengguna (App User) yang berhak login ke portal manajemen PPPoE
            ini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              Nama Lengkap <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="name"
              placeholder="mis. Ahmad Sanjaya"
              {...register("name")}
              className={errors.name ? "border-rose-500" : ""}
            />
            {errors.name && (
              <p className="text-xs text-rose-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              Alamat Email (Login) <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="mis. ahmad@microrad.net"
              {...register("email")}
              className={errors.email ? "border-rose-500" : ""}
            />
            {errors.email && (
              <p className="text-xs text-rose-500">{errors.email.message}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role">Role / Hak Akses</Label>
              <Select value={selectedRoleId} onValueChange={handleRoleChange}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Pilih Role" />
                </SelectTrigger>
                <SelectContent>
                  {allRoles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.id === "role-admin" ? (
                        <div className="flex items-center justify-center gap-2">
                          <ShieldUser className="h-4 w-4" />
                          Administrator (Akses Penuh)
                        </div>
                      ) : r.id === "role-manager" ? (
                        <div className="flex items-center justify-center gap-2">
                          <FolderKanban className="h-4 w-4" />
                          Manager (Operasional & Keuangan)
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <UserCog2 className="h-4 w-4" />
                          {r.name}
                        </div>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-slate-400">
                Role kustom dapat dikelola oleh Administrator di menu Role &amp;
                Permissions.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status Akun</Label>
              <Select
                value={selectedStatus}
                onValueChange={(val) =>
                  setValue("status", val as AppUserStatus, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Pilih Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="text-green-500 h-4 w-4" /> Active
                      (Aktif)
                    </div>
                  </SelectItem>
                  <SelectItem value="disabled">
                    <div className="flex items-center gap-2">
                      <CircleX className="text-red-500 h-4 w-4" /> Disabled
                      (Diblokir)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ringkasan Hak Akses</Label>
            <div className="rounded-lg border border-slate-100 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
              {selectedRoleId === "role-admin" && (
                <div className="flex flex-col items-center gap-2 md:flex-row md:items-start">
                  <ShieldUser className="h-7 w-7 mr-2 text-slate-500 dark:text-slate-400" />
                  <p>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Administrator
                    </span>{" "}
                    — Akses penuh ke semua modul: pelanggan, tagihan, sesi,
                    router, pengaturan, pengguna aplikasi, dan role.
                  </p>
                </div>
              )}
              {selectedRoleId === "role-manager" && (
                <div className="flex flex-col items-center gap-2 md:flex-row md:items-start">
                  <FolderKanban className="h-10 w-10 mr-2 text-slate-500 dark:text-slate-400" />
                  <p>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Manager
                    </span>{" "}
                    — Mengelola operasional harian, laporan keuangan, serta
                    pengawasan data pelanggan dan layanan dengan batasan izin
                    lanjutan yang diatur oleh Administrator. Tidak dapat
                    mengelola pengguna aplikasi, role, router NAS, atau
                    pengaturan sistem.
                  </p>
                </div>
              )}
              {selectedRoleId &&
                !["role-admin", "role-manager", "role-customer"].includes(
                  selectedRoleId,
                ) && (
                  <div className="flex flex-col items-center gap-2 md:flex-row md:items-start">
                    <UserCog2 className="h-7 w-7 mr-2 text-slate-500 dark:text-slate-400" />
                    <p>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        Role Kustom
                      </span>{" "}
                      — Permission read/create/update/delete sesuai konfigurasi
                      role yang dibuat oleh Administrator.
                    </p>
                  </div>
                )}
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
          {isEditing ? "Simpan Perubahan" : "Simpan Pengguna"}
        </Button>
      </div>
    </form>
  );
}
