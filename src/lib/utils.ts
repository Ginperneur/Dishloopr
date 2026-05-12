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

/**
 * Formats text to Title Case: each word starts with uppercase, rest lowercase
 * e.g., "PHILLY CHEESE STEAK" -> "Philly Cheese Steak", "lobster croquettes" -> "Lobster Croquettes"
 */
export function toTitleCase(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .trim()
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generates a URL-safe lowercase slug from arbitrary text.
 * Strips diacritics, replaces non-alphanumerics with dashes.
 */
export function slugify(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
