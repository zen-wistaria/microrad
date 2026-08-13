"use client";

import { ProfileForm } from "@/components/forms/profile-form";

export default function NewProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Tambah Profil Bandwidth Baru
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Definisikan paket kecepatan upload dan download baru untuk pelanggan
          PPPoE.
        </p>
      </div>

      <ProfileForm />
    </div>
  );
}
