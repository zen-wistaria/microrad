import { redirect } from "next/navigation";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Rute dasar /customers/[id] langsung dialihkan ke sub-rute /customers/[id]/overview.
 */
export default async function CustomerDetailPage({
  params,
  searchParams,
}: CustomerDetailPageProps) {
  const { id } = await params;
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
  redirect(`/customers/${id}/overview${queryString ? `?${queryString}` : ""}`);
}
