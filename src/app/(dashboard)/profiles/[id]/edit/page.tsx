"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { use } from "react";
import { ProfileForm } from "@/components/forms/profile-form";
import { useProfileQuery } from "@/lib/api/hooks";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditProfilePage({ params }: PageProps) {
  const { id } = use(params);
  const { data: res, isLoading, error } = useProfileQuery(id);
  const profile = res?.data;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p>Profil tidak ditemukan atau gagal dimuat.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProfileForm initialData={profile} isEditing />
    </div>
  );
}
