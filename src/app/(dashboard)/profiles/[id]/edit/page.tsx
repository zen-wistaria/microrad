"use client";

import { use } from "react";
import { ProfileForm } from "@/components/forms/profile-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfileQuery } from "@/lib/api/hooks";

interface EditProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function EditProfilePage({ params }: EditProfilePageProps) {
  const resolvedParams = use(params);
  const profileId = resolvedParams.id;

  const { data: profile, isLoading } = useProfileQuery(profileId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Edit Profil Bandwidth
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Perbarui batas kecepatan upload dan download untuk paket{" "}
          <span className="font-semibold">{profile?.name}</span>.
        </p>
      </div>

      {isLoading || !profile ? (
        <Card>
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : (
        <ProfileForm initialData={profile} isEditing={true} />
      )}
    </div>
  );
}
