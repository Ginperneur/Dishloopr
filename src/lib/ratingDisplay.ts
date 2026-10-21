export const OWN_REVIEW_THRESHOLD = 10;

export interface RatingInput {
  googleRating?: number | string | null;
  googleReviewsCount?: number | string | null;
  ownReviewCount?: number | null;
  ownAverage?: number | null;
}

export type RatingDisplay =
  | { mode: 'none' }
  | { mode: 'google-only'; google: number; googleCount: number }
  | { mode: 'both'; own: number; google: number | null; googleCount: number };

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function getRatingDisplay(input: RatingInput): RatingDisplay {
  const google = num(input.googleRating);
  const googleCount = Math.max(0, Math.round(num(input.googleReviewsCount)));
  const ownCount = num(input.ownReviewCount);
  const own = num(input.ownAverage);
  if (ownCount >= OWN_REVIEW_THRESHOLD && own > 0) {
    return { mode: 'both', own, google: google > 0 ? google : null, googleCount };
  }
  if (google > 0) return { mode: 'google-only', google, googleCount };
  return { mode: 'none' };
}

const LOCALES: Record<string, string> = { nl: 'nl-NL', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES' };
export const localeFor = (lang?: string) => LOCALES[(lang ?? 'nl').slice(0, 2)] ?? 'nl-NL';

export const formatScore = (n: number, lang?: string) =>
  n.toLocaleString(localeFor(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatCount = (n: number, lang?: string) => n.toLocaleString(localeFor(lang));
