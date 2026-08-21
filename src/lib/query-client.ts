import { QueryClient } from "@tanstack/react-query";

/**
 * Konfigurasi QueryClient TanStack Query yang optimal untuk MicroRAD:
 * - staleTime: 60 detik (mencegah refetch berlebihan saat navigasi tab/filter)
 * - gcTime: 5 menit (garbage collection di memori)
 * - refetchOnWindowFocus: false (mencegah layar berkedip/flicker saat berganti jendela)
 * - refetchOnReconnect: true (sinkronisasi otomatis saat internet reconnect)
 * - retry: 1 (1x percobaan ulang sebelum melempar error)
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: selalu buat query client baru per request
    return makeQueryClient();
  }
  // Browser: buat query client singleton jika belum ada
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
