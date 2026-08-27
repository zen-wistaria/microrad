"use client";

import { use } from "react";
import { InternetProfileForm } from "@/components/forms/internet-profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useInternetProfileQuery } from "@/lib/api/hooks";

interface EditInternetProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function EditInternetProfilePage({
  params,
}: EditInternetProfilePageProps) {
  const { id } = use(params);
  const { data: res, isLoading } = useInternetProfileQuery(id);
  const profile = res?.data;

  if (isLoading && !profile) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-slate-500">
        Paket Internet tidak ditemukan.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <InternetProfileForm initialData={profile} isEdit />
    </div>
  );
}
