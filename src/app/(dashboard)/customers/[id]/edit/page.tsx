"use client";

import { use } from "react";
import { CustomerForm } from "@/components/forms/customer-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCustomerQuery,
  useProfilesQuery,
  useRoutersQuery,
} from "@/lib/api/hooks";

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default function EditCustomerPage({ params }: EditCustomerPageProps) {
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;

  const { data: customer, isLoading: customerLoading } =
    useCustomerQuery(customerId);
  const { data: profiles = [], isLoading: profilesLoading } =
    useProfilesQuery();
  const { data: routers = [], isLoading: routersLoading } = useRoutersQuery();

  const loading =
    (customerLoading || profilesLoading || routersLoading) && !customer;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Edit Data Pelanggan
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Ubah konfigurasi profil, password baru, atau status akun untuk{" "}
          <span className="font-mono font-semibold">{customer?.username}</span>.
        </p>
      </div>

      {loading || !customer ? (
        <Card>
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : (
        <CustomerForm
          initialData={customer}
          profiles={profiles}
          routers={routers}
          isEditing={true}
        />
      )}
    </div>
  );
}
