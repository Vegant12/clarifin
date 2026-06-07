import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats an IDR amount as a human-readable Indonesian string.
 * Thresholds locked by Phase 9 D-11 and UI-SPEC IDR Formatting Contract.
 * Used in stock widget price + chart tooltip values.
 */
export function formatIDR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000_000).toFixed(2)} triliun`;
  }
  if (abs >= 1_000_000_000) {
    return `${sign}Rp ${(abs / 1_000_000_000).toFixed(2)} miliar`;
  }
  if (abs >= 1_000_000) {
    return `${sign}Rp ${(abs / 1_000_000).toFixed(2)} juta`;
  }
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}

/**
 * Short-form IDR for chart Y-axis tick labels — keeps axis readable.
 * UI-SPEC: ≥1T → "T", ≥1B → "M" (miliar), ≥1M → "Jt".
 */
export function formatIDRShort(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000_000).toFixed(0)}T`;
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(0)}M`;
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(0)}Jt`;
  return `${sign}Rp ${abs.toLocaleString("id-ID")}`;
}


