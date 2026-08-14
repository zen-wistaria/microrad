"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppUserForm } from "@/components/forms/app-user-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserById } from "@/lib/api/users";
import type { AppUser } from "@/lib/types";

interface EditUserPageProps {
  params: Promise<{ id: string }>;
}

export default function EditUserPage({ params }: EditUserPageProps) {
  const resolvedParams = use(params);
  const userId = resolvedParams.id;
  const router = useRouter();

  const [userData, setUserData] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const u = await getUserById(userId);
        if (!u) {
          toast.error("Pengguna tidak ditemukan.");
          router.push("/users");
          return;
        }
        setUserData(u);
      } catch {
        toast.error("Gagal memuat pengguna");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId, router]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Edit Pengguna Dashboard
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Ubah nama, email, role hak akses, atau status akun untuk{" "}
          <span className="font-semibold">{userData?.name}</span>.
        </p>
      </div>

      {loading || !userData ? (
        <Card>
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : (
        <AppUserForm initialData={userData} isEditing={true} />
      )}
    </div>
  );
}
