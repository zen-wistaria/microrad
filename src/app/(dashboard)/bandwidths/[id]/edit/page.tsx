"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { use } from "react";
import { BandwidthForm } from "@/components/forms/bandwidth-form";
import { useBandwidthQuery } from "@/lib/api/hooks";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditBandwidthPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: res, isLoading, error } = useBandwidthQuery(id);
  const bandwidth = res?.data;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !bandwidth) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p>Konfigurasi bandwidth tidak ditemukan atau gagal dimuat.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BandwidthForm initialData={bandwidth} isEditing />
    </div>
  );
}
