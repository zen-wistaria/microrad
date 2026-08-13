"use client";

import { useRouter } from "nextjs-toploader/app";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { ProfileForm } from "@/components/forms/profile-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfileById } from "@/lib/api/profiles";
import type { BandwidthProfile } from "@/lib/types";

interface EditProfilePageProps {
  params: Promise<{ id: string }>;
}

export default function EditProfilePage({ params }: EditProfilePageProps) {
  const resolvedParams = use(params);
  const profileId = resolvedParams.id;
  const router = useRouter();

  const [profile, setProfile] = useState<BandwidthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const p = await getProfileById(profileId);
        if (!p) {
          toast.error("Profil tidak ditemukan.");
          router.push("/profiles");
          return;
        }
        setProfile(p);
      } catch {
        toast.error("Gagal memuat profil");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profileId, router]);

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

      {loading || !profile ? (
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
