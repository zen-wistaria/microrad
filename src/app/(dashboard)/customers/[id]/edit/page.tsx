"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { toast } from "sonner";
import { CustomerForm } from "@/components/forms/customer-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCustomerById } from "@/lib/api/customers";
import { getProfiles } from "@/lib/api/profiles";
import { getRouters } from "@/lib/api/routers";
import type { BandwidthProfile, Customer, NasRouter } from "@/lib/types";

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default function EditCustomerPage({ params }: EditCustomerPageProps) {
  const resolvedParams = use(params);
  const customerId = resolvedParams.id;
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [profiles, setProfiles] = useState<BandwidthProfile[]>([]);
  const [routers, setRouters] = useState<NasRouter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cust, pList, rList] = await Promise.all([
          getCustomerById(customerId),
          getProfiles(),
          getRouters(),
        ]);
        if (!cust) {
          toast.error("Pelanggan tidak ditemukan.");
          router.push("/customers");
          return;
        }
        setCustomer(cust);
        setProfiles(pList);
        setRouters(rList);
      } catch {
        toast.error("Gagal memuat data pelanggan");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [customerId, router]);

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
