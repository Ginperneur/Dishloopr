// Only Dishloopr's own review score is shown. Google ratings may not be stored or reused under
// the Google Maps Platform EEA terms (docs/google-places-compliance.md).
export const OWN_REVIEW_THRESHOLD = 10;

export interface RatingInput {
  ownReviewCount?: number | null;
  ownAverage?: number | null;
}

export type RatingDisplay =
  | { mode: 'none' }
  | { mode: 'own'; own: number; count: number };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function getRatingDisplay(input: RatingInput): RatingDisplay {
  const count = num(input.ownReviewCount);
  const own = num(input.ownAverage);
  if (count >= OWN_REVIEW_THRESHOLD && own > 0) return { mode: 'own', own, count };
  return { mode: 'none' };
}

const LOCALES: Record<string, string> = { nl: 'nl-NL', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES' };
export const localeFor = (lang?: string) => LOCALES[(lang ?? 'nl').slice(0, 2)] ?? 'nl-NL';

export const formatScore = (n: number, lang?: string) =>
  n.toLocaleString(localeFor(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatCount = (n: number, lang?: string) => n.toLocaleString(localeFor(lang));
