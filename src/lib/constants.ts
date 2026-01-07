// Centralized constants for restaurant display

export const PRICE_LABELS: { [key: number]: string } = {
  1: '€',
  2: '€€',
  3: '€€€',
  4: '€€€€',
};

export const PRICE_LABELS_FULL: { [key: number]: string } = {
  1: '€ · Budget',
  2: '€€ · Moderate',
  3: '€€€ · Upscale',
  4: '€€€€ · Luxury',
};

export const AMBIENCE_TAG_STYLES: { [key: string]: string } = {
  'romantic': 'tag-romantic',
  'family-friendly': 'tag-family',
  'high-end': 'tag-highend',
  'cozy': 'tag-cozy',
  'business': 'tag-business',
  'trendy': 'tag-cozy',
  'casual': 'tag-family',
  'lively': 'tag-romantic',
  'intimate': 'tag-romantic',
  'relaxed': 'tag-cozy',
};

// Mapping from database tag values to i18n keys
export const AMBIENCE_TAG_I18N_KEYS: { [key: string]: string } = {
  'romantic': 'filters.romantic',
  'family-friendly': 'filters.familyFriendly',
  'high-end': 'filters.highEnd',
  'cozy': 'filters.cozy',
  'business': 'filters.business',
  'trendy': 'filters.trendy',
  'casual': 'filters.casual',
  'lively': 'filters.lively',
  'intimate': 'filters.intimate',
  'relaxed': 'filters.relaxed',
};

export const LANGUAGES = [
  { code: 'nl', label: 'NL' },
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
] as const;

export const WEEK_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
