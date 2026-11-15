// The eight sections of the owner dashboard, and how the old tab ids (still used by Stripe
// return URLs, monthly report mails and bookmarks) map onto them.

export type OwnerTab =
  | 'overview'
  | 'profile'
  | 'menu'
  | 'reviews'
  | 'reservations'
  | 'insights'
  | 'promotions'
  | 'settings';

export const OWNER_TABS: { id: OwnerTab; label: string; requiresVerified: boolean }[] = [
  { id: 'overview', label: 'Overzicht', requiresVerified: false },
  { id: 'profile', label: 'Profiel', requiresVerified: false },
  { id: 'menu', label: 'Menu', requiresVerified: false },
  { id: 'reviews', label: 'Reviews en feedback', requiresVerified: false },
  { id: 'reservations', label: 'Reserveringen', requiresVerified: true },
  { id: 'insights', label: 'Inzichten', requiresVerified: true },
  { id: 'promotions', label: 'Promoties', requiresVerified: false },
  { id: 'settings', label: 'Instellingen en pakketten', requiresVerified: false },
];

/** Sub-tab inside a section that an old id points at (Markt now lives under Inzichten). */
export type OwnerTarget = { tab: OwnerTab; sub?: string };

const LEGACY: Record<string, OwnerTarget> = {
  content: { tab: 'profile' },
  market: { tab: 'insights', sub: 'market' },
  marketing: { tab: 'promotions' },
  integrations: { tab: 'reservations' },
  invoices: { tab: 'settings', sub: 'billing' },
  // Older notifications and links used these ids.
  'dish-confirmation': { tab: 'menu' },
  optimization: { tab: 'insights' },
  evenementen: { tab: 'promotions' },
};

export function resolveOwnerTab(id: string | null | undefined): OwnerTarget {
  if (!id) return { tab: 'overview' };
  if (OWNER_TABS.some(t => t.id === id)) return { tab: id as OwnerTab };
  return LEGACY[id] ?? { tab: 'overview' };
}
