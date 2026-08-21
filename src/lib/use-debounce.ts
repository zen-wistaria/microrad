import { useEffect, useState } from "react";

/**
 * Hook untuk men-debounce nilai yang berubah cepat (seperti input teks search).
 * Menghindari pemanggilan API backend secara berlebihan pada setiap ketukan keyboard.
 *
 * @param value Nilai yang ingin di-debounce
 * @param delayMs Waktu tunggu dalam milidetik (default: 350ms)
 */
export function useDebounce<T>(value: T, delayMs = 350): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
