"use client";

import { RouterForm } from "@/components/forms/router-form";

export default function NewRouterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Tambah NAS Router MikroTik
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Daftarkan IP Address router PPPoE Server agar dapat mengirim
          Access-Request ke FreeRADIUS.
        </p>
      </div>

      <RouterForm />
    </div>
  );
}
