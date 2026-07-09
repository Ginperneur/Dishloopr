/**
 * Frontend feature flags for paid checkout flows.
 *
 * Backend Stripe products/price IDs are not yet activated. Until the operator
 * sets the matching env vars, all paid checkout buttons render as "Binnenkort
 * beschikbaar" and cannot start a Stripe session. This avoids broken checkouts
 * while keeping the pricing UI visible.
 *
 * To enable a flow, set the corresponding VITE_* env var to "true" in .env
 * AFTER the Stripe price IDs / edge-function secrets are configured.
 */

const flag = (v: string | undefined) => (v ?? '').toLowerCase() === 'true';

export const CHECKOUT_ENABLED = {
  /** Owner Pro (monthly / yearly recurring subscription) */
  pro: flag(import.meta.env.VITE_ENABLE_PRO_CHECKOUT as string | undefined),
  /** Sponsored dish×city listings */
  sponsored: flag(import.meta.env.VITE_ENABLE_SPONSORED_CHECKOUT as string | undefined),
  /** Extra paid profile tags (recurring per-tag subscription) */
  tag: flag(import.meta.env.VITE_ENABLE_TAG_CHECKOUT as string | undefined),
} as const;

export const COMING_SOON_LABEL = 'Binnenkort beschikbaar';
export const COMING_SOON_TOAST =
  'Deze aankoop is binnenkort beschikbaar. We activeren Stripe zodra de prijzen definitief zijn.';