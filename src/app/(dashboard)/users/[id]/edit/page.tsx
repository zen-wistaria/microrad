"use client";

import { use } from "react";
import { AppUserForm } from "@/components/forms/app-user-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserDetailQuery } from "@/lib/api/hooks";

interface EditUserPageProps {
  params: Promise<{ id: string }>;
}

export default function EditUserPage({ params }: EditUserPageProps) {
  const resolvedParams = use(params);
  const userId = resolvedParams.id;

  const { data: userData, isLoading } = useUserDetailQuery(userId);

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

      {isLoading || !userData ? (
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
