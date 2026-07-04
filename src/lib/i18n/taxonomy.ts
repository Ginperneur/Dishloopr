import type { TFunction } from 'i18next';
import { AMBIENCE_TAG_I18N_KEYS } from '@/lib/constants';

/**
 * Centralized mappings from DB enum values to i18n keys.
 * DB stores capitalized Dutch values (see memory: data-normalization-strategy).
 * Keep these in sync with `taxonomy.*` sections in src/i18n/locales/*.json.
 */

export const CUISINE_I18N_KEYS: Record<string, string> = {
  Internationaal: 'taxonomy.cuisine.international',
  Nederlands: 'taxonomy.cuisine.dutch',
  Frans: 'taxonomy.cuisine.french',
  Italiaans: 'taxonomy.cuisine.italian',
  Chinees: 'taxonomy.cuisine.chinese',
  Turks: 'taxonomy.cuisine.turkish',
  Aziatisch: 'taxonomy.cuisine.asian',
  Sushi: 'taxonomy.cuisine.sushi',
  Surinaams: 'taxonomy.cuisine.surinamese',
  Indonesisch: 'taxonomy.cuisine.indonesian',
  Pizza: 'taxonomy.cuisine.pizza',
  'Vis & Zeevruchten': 'taxonomy.cuisine.seafood',
  'Midden-Oosters': 'taxonomy.cuisine.middleEastern',
  Bistro: 'taxonomy.cuisine.bistro',
  Japans: 'taxonomy.cuisine.japanese',
  Indiaas: 'taxonomy.cuisine.indian',
  Fusion: 'taxonomy.cuisine.fusion',
  Grieks: 'taxonomy.cuisine.greek',
  Burger: 'taxonomy.cuisine.burger',
  Steakhouse: 'taxonomy.cuisine.steakhouse',
  Amerikaans: 'taxonomy.cuisine.american',
  Brasserie: 'taxonomy.cuisine.brasserie',
  Thais: 'taxonomy.cuisine.thai',
  Veganistisch: 'taxonomy.cuisine.vegan',
  Mexicaans: 'taxonomy.cuisine.mexican',
  Gastropub: 'taxonomy.cuisine.gastropub',
  Vegetarisch: 'taxonomy.cuisine.vegetarian',
  Tapas: 'taxonomy.cuisine.tapas',
  Mediterraans: 'taxonomy.cuisine.mediterranean',
  Spaans: 'taxonomy.cuisine.spanish',
  Argentijns: 'taxonomy.cuisine.argentinian',
  Marokkaans: 'taxonomy.cuisine.moroccan',
  Ramen: 'taxonomy.cuisine.ramen',
  Koreaans: 'taxonomy.cuisine.korean',
  BBQ: 'taxonomy.cuisine.bbq',
  Vietnamees: 'taxonomy.cuisine.vietnamese',
  Caribisch: 'taxonomy.cuisine.caribbean',
  Afghaans: 'taxonomy.cuisine.afghan',
  Ethiopisch: 'taxonomy.cuisine.ethiopian',
  'Dim Sum': 'taxonomy.cuisine.dimsum',
  Peruaans: 'taxonomy.cuisine.peruvian',
  Braziliaans: 'taxonomy.cuisine.brazilian',
  Libanees: 'taxonomy.cuisine.lebanese',
  Kantonees: 'taxonomy.cuisine.cantonese',
};

export const COURSE_TYPE_I18N_KEYS: Record<string, string> = {
  hoofdgerecht: 'taxonomy.course.main',
  voorgerecht: 'taxonomy.course.starter',
  nagerecht: 'taxonomy.course.nagerecht',
  dessert: 'taxonomy.course.nagerecht',
  borrel: 'taxonomy.course.borrel',
  drank: 'taxonomy.course.drink',
  menu: 'taxonomy.course.menu',
  bijgerecht: 'taxonomy.course.side',
};

export const DIETARY_I18N_KEYS: Record<string, string> = {
  vegetarian: 'taxonomy.dietary.vegetarian',
  vegan: 'taxonomy.dietary.vegan',
  gluten_free: 'taxonomy.dietary.glutenFree',
  glutenFree: 'taxonomy.dietary.glutenFree',
  halal: 'taxonomy.dietary.halal',
  kosher: 'taxonomy.dietary.kosher',
  lactose_free: 'taxonomy.dietary.lactoseFree',
  lactoseFree: 'taxonomy.dietary.lactoseFree',
  dairy_free: 'taxonomy.dietary.dairyFree',
  nut_free: 'taxonomy.dietary.nutFree',
};

export const PRICE_LEVEL_I18N_KEYS: Record<number, string> = {
  1: 'taxonomy.priceLevel.budget',
  2: 'taxonomy.priceLevel.moderate',
  3: 'taxonomy.priceLevel.upscale',
  4: 'taxonomy.priceLevel.luxury',
};

export type TaxonomyType = 'cuisine' | 'ambience' | 'course' | 'dietary' | 'priceLevel';

const MAPS: Record<Exclude<TaxonomyType, 'priceLevel'>, Record<string, string>> = {
  cuisine: CUISINE_I18N_KEYS,
  ambience: AMBIENCE_TAG_I18N_KEYS,
  course: COURSE_TYPE_I18N_KEYS,
  dietary: DIETARY_I18N_KEYS,
};

/** Capitalize unknown raw values as a sane fallback. */
function humanize(value: string): string {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Translate a taxonomy value. Returns the localized string if known,
 * otherwise a humanized version of the raw value so the UI never breaks.
 */
export function tTaxonomy(
  t: TFunction,
  type: TaxonomyType,
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return '';

  if (type === 'priceLevel') {
    const key = PRICE_LEVEL_I18N_KEYS[Number(value)];
    return key ? (t(key) as string) : String(value);
  }

  const raw = String(value);
  const map = MAPS[type];
  const key = map[raw];
  if (key) {
    const translated = t(key) as string;
    // If i18next returns the key itself (missing translation), fall through to humanize
    if (translated && translated !== key) return translated;
  }
  return humanize(raw);
}