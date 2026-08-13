"use client";

import { AppUserForm } from "@/components/forms/app-user-form";

export default function NewUserPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Tambah Pengguna Dashboard Baru
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Daftarkan akun administrator atau operator baru yang diizinkan
          mengakses portal ini.
        </p>
      </div>

      <AppUserForm />
    </div>
  );
}
