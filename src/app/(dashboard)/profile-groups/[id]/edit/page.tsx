"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { use } from "react";
import { ProfileGroupForm } from "@/components/forms/profile-group-form";
import { useProfileGroupQuery } from "@/lib/api/hooks";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditProfileGroupPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: res, isLoading, error } = useProfileGroupQuery(id);
  const group = res?.data;

  if (isLoading && !group) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || (!isLoading && !group)) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-500">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p>Profile Group tidak ditemukan atau gagal dimuat.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProfileGroupForm initialData={group} isEditing />
    </div>
  );
}
