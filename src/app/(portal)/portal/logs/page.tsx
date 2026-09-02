import { redirect } from "next/navigation";

interface PortalLogsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Rute dasar /portal/logs langsung dialihkan ke sub-rute /portal/logs/login.
 */
export default async function PortalLogsPage({
  searchParams,
}: PortalLogsPageProps) {
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
  redirect(`/portal/logs/login${queryString ? `?${queryString}` : ""}`);
}
