import { redirect } from "next/navigation";

interface PortalUsagePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Rute dasar /portal/usage langsung dialihkan ke sub-rute /portal/usage/daily.
 */
export default async function PortalUsagePage({
  searchParams,
}: PortalUsagePageProps) {
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
  redirect(`/portal/usage/daily${queryString ? `?${queryString}` : ""}`);
}
