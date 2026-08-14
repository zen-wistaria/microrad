"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, UserCheck } from "lucide-react";
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
import { createUser, updateUser } from "@/lib/api/users";
import type { AppUser, AppUserRole, AppUserStatus } from "@/lib/types";
import { getErrorMessage } from "@/lib/utils";

const appUserSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Format email tidak valid"),
  role: z.enum(["admin", "operator", "customer"]),
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
      status: initialData?.status || "active",
    },
  });

  const selectedRole = watch("role");
  const selectedStatus = watch("status");

  const onSubmit = async (data: AppUserFormValues) => {
    try {
      setSubmitting(true);
      if (isEditing && initialData) {
        await updateUser(initialData.id, {
          name: data.name,
          email: data.email,
          role: data.role as AppUserRole,
          status: data.status as AppUserStatus,
        });
        toast.success(`Pengguna ${data.name} berhasil diperbarui.`);
      } else {
        await createUser({
          name: data.name,
          email: data.email,
          role: data.role as AppUserRole,
          status: data.status as AppUserStatus,
        });
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
              <Select
                value={selectedRole}
                onValueChange={(val) =>
                  setValue("role", val as AppUserRole, { shouldValidate: true })
                }
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Pilih Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    🛡️ Administrator (Akses Penuh)
                  </SelectItem>
                  <SelectItem value="operator">
                    👤 Operator / NOC (Monitoring & Operasional)
                  </SelectItem>
                  <SelectItem value="customer">
                    🏠 Pelanggan (Portal Pelanggan)
                  </SelectItem>
                </SelectContent>
              </Select>
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
                  <SelectItem value="active">🟢 Active (Bisa Login)</SelectItem>
                  <SelectItem value="disabled">
                    ⚪ Disabled (Diblokir)
                  </SelectItem>
                </SelectContent>
              </Select>
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
