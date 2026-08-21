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
 * Generate kandidat username PPPoE format user_<6 digit angka acak>
 */
export function generateCandidateUsername(prefix = "user_"): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}${num}`;
}
