"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  AtSign,
  CheckCircle,
  CircleX,
  Eye,
  EyeOff,
  FolderKanban,
  Loader2,
  Lock,
  Mail,
  ShieldUser,
  User,
  UserCheck,
  UserCog2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
  useCreateUserMutation,
  useRolesQuery,
  useUpdateUserMutation,
} from "@/lib/api/hooks";
import type { AppUser, AppUserRole, AppUserStatus } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

const createAppUserSchema = (isEditing: boolean) =>
  z
    .object({
      name: z.string().min(2, "Nama minimal 2 karakter"),
      username: z
        .string()
        .regex(
          /^[a-zA-Z0-9_.-]*$/,
          "Username hanya boleh berisi huruf, angka, garis bawah (_), titik (.), atau strip (-)",
        )
        .optional()
        .or(z.literal("")),
      email: z.string().email("Format email tidak valid"),
      password: z.string().optional().or(z.literal("")),
      role: z.enum(["admin", "manager", "operator", "customer"]),
      roleId: z.string().optional(),
      status: z.enum(["active", "disabled"]),
    })
    .superRefine((data, ctx) => {
      if (!isEditing) {
        if (!data.password || data.password.trim().length < 6) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["password"],
            message:
              "Kata sandi wajib diisi minimal 6 karakter untuk pengguna baru",
          });
        }
      } else if (
        data.password &&
        data.password.trim().length > 0 &&
        data.password.trim().length < 6
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message:
            "Kata sandi baru minimal 6 karakter (atau kosongkan jika tidak diubah)",
        });
      }
    });

type AppUserFormValues = {
  name: string;
  username?: string;
  email: string;
  password?: string;
  role: "admin" | "manager" | "operator" | "customer";
  roleId?: string;
  status: "active" | "disabled";
};

interface AppUserFormProps {
  initialData?: AppUser;
  isEditing?: boolean;
}

export function AppUserForm({
  initialData,
  isEditing = false,
}: AppUserFormProps) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const { data: allRoles = [] } = useRolesQuery();
  const createUserMutation = useCreateUserMutation();
  const updateUserMutation = useUpdateUserMutation();

  const submitting =
    createUserMutation.isPending || updateUserMutation.isPending;

  const schema = useMemo(() => createAppUserSchema(isEditing), [isEditing]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AppUserFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name || "",
      username: initialData?.username || "",
      email: initialData?.email || "",
      password: "",
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
      const payload = {
        name: data.name.trim(),
        username: data.username?.trim() || undefined,
        email: data.email.trim(),
        password: data.password?.trim() || undefined,
        role: data.role as AppUserRole,
        roleId: data.roleId as string,
        status: data.status as AppUserStatus,
      };

      if (isEditing && initialData) {
        await updateUserMutation.mutateAsync({
          id: initialData.id,
          updates: payload,
        });
        toast.success(`Pengguna ${data.name} berhasil diperbarui.`);
      } else {
        await createUserMutation.mutateAsync(payload);
        toast.success(`Pengguna ${data.name} berhasil ditambahkan.`);
      }
      router.push("/users");
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Gagal menyimpan pengguna aplikasi.");
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
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Nama Lengkap */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Nama Lengkap <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="name"
                  placeholder="mis. Ahmad Sanjaya"
                  {...register("name")}
                  className={`pl-9 ${errors.name ? "border-rose-500" : ""}`}
                />
              </div>
              {errors.name && (
                <p className="text-xs text-rose-500">{errors.name.message}</p>
              )}
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username">
                Username{" "}
                <span className="text-xs text-slate-400">(Opsional)</span>
              </Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="username"
                  placeholder="mis. ahmadsanjaya"
                  {...register("username")}
                  className={`pl-9 ${errors.username ? "border-rose-500" : ""}`}
                />
              </div>
              {errors.username ? (
                <p className="text-xs text-rose-500">
                  {errors.username.message}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Dapat digunakan sebagai identitas login alternatif selain
                  email.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">
                Alamat Email (Login) <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="mis. ahmad@microrad.net"
                  {...register("email")}
                  className={`pl-9 ${errors.email ? "border-rose-500" : ""}`}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-rose-500">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">
                {isEditing ? (
                  <>
                    Kata Sandi Baru{" "}
                    <span className="text-xs text-slate-400 font-normal">
                      (Opsional)
                    </span>
                  </>
                ) : (
                  <>
                    Kata Sandi (Password){" "}
                    <span className="text-rose-500">*</span>
                  </>
                )}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    isEditing
                      ? "Kosongkan jika tidak diubah"
                      : "Minimal 6 karakter"
                  }
                  {...register("password")}
                  className={`pl-9 pr-10 ${errors.password ? "border-rose-500" : ""}`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password ? (
                <p className="text-xs text-rose-500">
                  {errors.password.message}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400">
                  {isEditing
                    ? "Isi hanya jika ingin mereset password akun pengguna ini."
                    : "Kata sandi yang digunakan pengguna untuk login ke dashboard."}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Role Hak Akses */}
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

            {/* Status Akun */}
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

          {/* Ringkasan Hak Akses */}
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
