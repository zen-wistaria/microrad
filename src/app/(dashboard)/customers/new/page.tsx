"use client";

import { useEffect, useState } from "react";
import { CustomerForm } from "@/components/forms/customer-form";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfiles } from "@/lib/api/profiles";
import { getRouters } from "@/lib/api/routers";
import type { BandwidthProfile, NasRouter } from "@/lib/types";

export default function NewCustomerPage() {
  const [profiles, setProfiles] = useState<BandwidthProfile[]>([]);
  const [routers, setRouters] = useState<NasRouter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pList, rList] = await Promise.all([getProfiles(), getRouters()]);
        setProfiles(pList);
        setRouters(rList);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Tambah Pelanggan Baru
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Daftarkan akun pelanggan baru ke sistem FreeRADIUS dan tentukan profil
          batas kecepatan bandwidth.
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
