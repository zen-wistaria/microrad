/**
 * Pure generator functions (Client-Safe & Server-Safe)
 * Tidak mengimpor Prisma/DB agar aman digunakan di Client Components Next.js.
 */

/**
 * Generate password PPPoE acak (kombinasi huruf besar/kecil & angka, 8 karakter)
 */
export function generatePppoePassword(length = 8): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate kandidat username PPPoE format cust_tahun_bulan_tanggal_order
 * Contoh: cust_202608210001
 */
export function generateCandidateUsername(
  prefix = "cust_",
  date: Date = new Date(),
  seq = 1,
): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const order = String(seq).padStart(4, "0");
  return `${prefix}${yyyy}${mm}${dd}${order}`;
}
