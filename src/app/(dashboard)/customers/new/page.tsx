"use client";

import { CustomerForm } from "@/components/forms/customer-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePppProfilesQuery, useRoutersQuery } from "@/lib/api/hooks";

export default function NewCustomerPage() {
  const { data: profilesRes, isLoading: profilesLoading } =
    usePppProfilesQuery();
  const { data: routers = [], isLoading: routersLoading } = useRoutersQuery();

  const profiles = profilesRes?.data || [];
  const loading = (profilesLoading || routersLoading) && profiles.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Tambah Pelanggan Baru
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Daftarkan akun pelanggan baru ke sistem FreeRADIUS dan tentukan paket
          layanan PPP Profile.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : (
        <CustomerForm profiles={profiles} routers={routers} />
      )}
    </div>
  );
}
