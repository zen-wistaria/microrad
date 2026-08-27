"use client";

import { use } from "react";
import { RouterForm } from "@/components/forms/router-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouterNasQuery } from "@/lib/api/hooks";

interface EditRouterPageProps {
  params: Promise<{ id: string }>;
}

export default function EditRouterPage({ params }: EditRouterPageProps) {
  const resolvedParams = use(params);
  const routerId = resolvedParams.id;

  const { data: routerData, isLoading } = useRouterNasQuery(routerId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Edit Data Router NAS
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Perbarui IP address, nama, atau lokasi penempatan router{" "}
          <span className="font-semibold">{routerData?.name}</span>.
        </p>
      </div>

      {isLoading && !routerData ? (
        <Card>
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : !routerData ? (
        <div className="p-8 text-center text-slate-500">
          Router NAS tidak ditemukan.
        </div>
      ) : (
        <RouterForm initialData={routerData} isEditing={true} />
      )}
    </div>
  );
}
