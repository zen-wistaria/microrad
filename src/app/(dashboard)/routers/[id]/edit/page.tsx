"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { RouterForm } from "@/components/forms/router-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getRouterById } from "@/lib/api/routers";
import type { NasRouter } from "@/lib/types";

interface EditRouterPageProps {
  params: Promise<{ id: string }>;
}

export default function EditRouterPage({ params }: EditRouterPageProps) {
  const resolvedParams = use(params);
  const routerId = resolvedParams.id;
  const router = useRouter();

  const [routerData, setRouterData] = useState<NasRouter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const r = await getRouterById(routerId);
        if (!r) {
          toast.error("Router NAS tidak ditemukan.");
          router.push("/routers");
          return;
        }
        setRouterData(r);
      } catch {
        toast.error("Gagal memuat router");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [routerId, router]);

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

      {loading || !routerData ? (
        <Card>
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : (
        <RouterForm initialData={routerData} isEditing={true} />
      )}
    </div>
  );
}
