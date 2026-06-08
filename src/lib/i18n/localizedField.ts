import i18n from '@/i18n';

export type I18nMap = Record<string, string | null | undefined> | null | undefined;

/**
 * Resolve a localized JSONB field with sane fallback:
 * 1. current language
 * 2. Dutch (canonical source)
 * 3. first non-empty value in the map
 * 4. legacy single-string fallback (the original column)
 */
export function localizedField(
  i18nMap: I18nMap,
  fallback?: string | null,
  lang?: string,
): string {
  const language = (lang || i18n.language || 'nl').split('-')[0];
  const map = (i18nMap || {}) as Record<string, string | null | undefined>;
  const pick =
    map[language] ||
    map.nl ||
    Object.values(map).find((v) => typeof v === 'string' && v.trim().length > 0);
  return (pick || fallback || '') as string;
}

export function useLocalizedField() {
  // Hook variant in case we later need re-render on language change; for now
  // components that need reactivity already call useTranslation().
  return localizedField;
}

export const I18N_LANGUAGES: { code: string; label: string }[] = [
  { code: 'nl', label: '🇳🇱 NL' },
  { code: 'en', label: '🇬🇧 EN' },
  { code: 'de', label: '🇩🇪 DE' },
  { code: 'fr', label: '🇫🇷 FR' },
  { code: 'es', label: '🇪🇸 ES' },
];