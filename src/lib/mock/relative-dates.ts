/**
 * Tanggal relatif untuk data mock.
 *
 * Semua data mock disimpan dengan tanggal HARDCODED (mis. "2026-08-12T07:10:00Z")
 * yang cepat menjadi basi — user membuka aplikasi minggu/bulan berikutnya,
 * data terlihat "masa lalu" dan tidak pernah melewati tanggal sekarang.
 *
 * Utilitas ini menggeser tanggal-tanggal tersebut RELATIF terhadap hari ini:
 *   - "now - 4h18m"   → dihitung ulang setiap kali halaman dimuat
 *   - "5 hari lalu"   → 5 hari sebelum hari ini
 *   - "2 minggu lalu" → selalu "2 minggu lalu", dst.
 *
 * Dengan begitu data mock selalu mengikuti hari berjalan dan TIDAK PERNAH
 * melampaui tanggal sekarang (cap di momen pembuatan).
 */

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** "now" relatif terhadap waktu sekarang, tanpa bisa melewati "now" */
export function relNow(daysAgo: number, hoursAgo = 0, minutesAgo = 0): Date {
  return new Date(
    Date.now() - daysAgo * DAY - hoursAgo * HOUR - minutesAgo * MIN,
  );
}

/** "now" relatif (iso string) — hasilnya selalu di masa lalu / sekarang */
export function relNowIso(
  daysAgo: number,
  hoursAgo = 0,
  minutesAgo = 0,
): string {
  return relNow(daysAgo, hoursAgo, minutesAgo).toISOString();
}

/** Durasi detik antara dua tanggal relatif (utk session duration) */
export function relSecondsBetween(
  start: { daysAgo: number; hoursAgo?: number; minutesAgo?: number },
  stop: { daysAgo: number; hoursAgo?: number; minutesAgo?: number },
): number {
  return Math.max(
    1,
    Math.round(
      (relNow(stop.daysAgo, stop.hoursAgo, stop.minutesAgo).getTime() -
        relNow(start.daysAgo, start.hoursAgo, start.minutesAgo).getTime()) /
        1000,
    ),
  );
}

/**
 * Konversi tanggal hardcoded "2026-07-15T16:00:00Z" menjadi tanggal relatif
 * hari ini: "5 bulan lalu" (2026-07 → 2026-08 = 1 bulan → 2026-06?).
 * Pemakaian: bulanBerlalu(5, 16, 0) → 5 bulan sebelum hari ini, jam 16:00.
 */
export function relMonthsAgo(monthsAgo: number, hours = 10, minutes = 0): Date {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - monthsAgo);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function relMonthsAgoIso(
  monthsAgo: number,
  hours = 10,
  minutes = 0,
): string {
  return relMonthsAgo(monthsAgo, hours, minutes).toISOString();
}

/** Hari ke-1 bulan berjalan (utk invoice issueDate) */
export function firstOfCurrentMonth(hours = 8, minutes = 0): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

export function firstOfCurrentMonthIso(hours = 8, minutes = 0): string {
  return firstOfCurrentMonth(hours, minutes).toISOString();
}

export { DAY, HOUR, MIN };
