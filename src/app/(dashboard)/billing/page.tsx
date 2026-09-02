import { redirect } from "next/navigation";

interface BillingPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Rute dasar /billing langsung dialihkan ke sub-rute /billing/invoices.
 */
export default async function BillingPage({ searchParams }: BillingPageProps) {
  const sp = searchParams ? await searchParams : {};
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") {
      query.set(key, value);
    } else if (Array.isArray(value)) {
      for (const v of value) query.append(key, v);
    }
  }

  const queryString = query.toString();
  redirect(`/billing/invoices${queryString ? `?${queryString}` : ""}`);
}
