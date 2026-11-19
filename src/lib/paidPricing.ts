/**
 * Prices of the paid places and bundles, excl. VAT, in one place (agreed 19 November 2026).
 * The database prices each page by demand (pp_list_price); these are the starting points and
 * the bundle surcharges, the same numbers create-package-checkout uses.
 */
export const FOUNDING_WINDOW_END = new Date('2027-01-05T23:59:59+01:00');
export const foundingWindowOpen = () => new Date() <= FOUNDING_WINDOW_END;

export const PRICES = {
  uitgelicht: { from: 9900, founding: 5900, foundingYear: 59000 },
  topplek: { from: 19900 },
  groei: { surcharge: 2000, founding: 7900 },
  dominant: { surcharge: 5000 },
  spotlightWeek: 3900,
  newsletterPer1000: 3000,
  newsletterMin: 2000,
  event: 500,
  menuMonth: 1900,
  menuOnce: 7900,
} as const;

export type PlacePackage = 'uitgelicht' | 'groei' | 'topplek' | 'dominant';
export const placeKind = (p: PlacePackage) => (p === 'topplek' || p === 'dominant' ? 'topplek' : 'uitgelicht');

/** Monthly price of a package on a page, given that page's list prices. */
export function packageCents(p: PlacePackage, page: { list_price_cents: number; topplek_price_cents: number }, founding: boolean): number {
  if (p === 'uitgelicht') return founding ? PRICES.uitgelicht.founding : page.list_price_cents;
  if (p === 'groei') return founding ? PRICES.groei.founding : page.list_price_cents + PRICES.groei.surcharge;
  if (p === 'topplek') return page.topplek_price_cents;
  return page.topplek_price_cents + PRICES.dominant.surcharge;
}

export const PACKAGE_NAMES: Record<PlacePackage, string> = {
  uitgelicht: 'Uitgelicht', groei: 'Groei', topplek: 'Topplek', dominant: 'Dominant',
};

export const euroCents = (cents: number) =>
  `€${(cents / 100).toLocaleString('nl-NL', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
