import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a dish name to sentence case: first letter uppercase, rest lowercase
 * e.g., "STEAK" -> "Steak", "brisket" -> "Brisket", "PULLED PORK" -> "Pulled pork"
 */
export function formatDishName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (trimmed.length === 0) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}
