/**
 * Client fetch helper untuk REST API /api/v1.
 * Semua fungsi api/* menjadi wrapper tipis di atas helper ini.
 */

const BASE = "/api/v1";

export class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let message = "Terjadi kesalahan pada server.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // body bukan JSON — pakai default
    }
    throw new ApiClientError(res.status, message);
  }
  return (await res.json()) as T;
}

/** Bangun query string dari params — skip undefined/null/""/"all" */
export function toQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (value === "all") continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

export interface Paginated<T> {
  data: T[];
  total: number;
}

/** GET dengan response {data, total} (list + pagination) */
export async function paginated<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined | null> = {},
): Promise<Paginated<T>> {
  return apiFetch<Paginated<T>>(`${path}${toQuery(params)}`);
}
