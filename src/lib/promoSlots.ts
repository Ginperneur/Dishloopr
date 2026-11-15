// Paid promotion slots (Vraag doorsturen): what the dashboard offers for one dish in one city.
// Availability and prices come from promo_market_status in the database.

export interface MarketStatus {
  list_price_cents: number;
  slots: number;
  taken: number;
  open_bids: number;
  highest_bid_cents: number | null;
  searches_per_month: number | null;
  suppliers: number | null;
  next_auction: string;
  my_slot: { status: 'active' | 'ending' | 'pending_payment'; price_cents: number; term_end: string | null } | null;
  my_bid: { id: string; status: 'open' | 'won'; amount_cents: number; clearing_cents: number | null; pay_by: string | null } | null;
}

export type RoutingAction =
  | { kind: 'active'; text: string }
  | { kind: 'ending'; text: string }
  | { kind: 'pay_won'; text: string }
  | { kind: 'buy'; text: string }
  | { kind: 'bid'; text: string };

export const formatEuroCents = (cents: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export function routingAction(s: MarketStatus): RoutingAction {
  if (s.my_slot?.status === 'active') return { kind: 'active', text: `Je hebt deze plek, voor ${formatEuroCents(s.my_slot.price_cents)} per maand.` };
  if (s.my_slot?.status === 'ending') return { kind: 'ending', text: 'Je plek loopt af aan het eind van je betaalde periode. Bied opnieuw om hem terug te krijgen.' };
  if (s.my_bid?.status === 'won') return { kind: 'pay_won', text: `Rond af voor ${formatEuroCents(s.my_bid.clearing_cents ?? s.my_bid.amount_cents)} per maand` };
  const othersWaiting = s.open_bids - (s.my_bid?.status === 'open' ? 1 : 0) > 0;
  if (s.taken < s.slots && !othersWaiting) return { kind: 'buy', text: `Koop deze plek voor ${formatEuroCents(s.list_price_cents)} per maand` };
  if (s.my_bid?.status === 'open') return { kind: 'bid', text: `Je staat op de wachtlijst met ${formatEuroCents(s.my_bid.amount_cents)} per maand. Pas je bod aan of wacht op de veiling.` };
  return { kind: 'bid', text: 'Alle plekken zijn bezet of er wachten al bieders. Bied het bedrag dat je maximaal per maand wilt betalen.' };
}

/**
 * The auction rule in plain code, for the explanation page and its worked example (the database
 * applies the same rule in promo_settle / uitgelicht_settle): the highest `slots` amounts win and
 * all winners pay the highest amount that did not win, at least the list price.
 */
export function auctionOutcome(amounts: { name: string; cents: number }[], slots: number, listCents: number) {
  const ranked = [...amounts].sort((a, b) => b.cents - a.cents);
  const winners = ranked.slice(0, slots);
  const losers = ranked.slice(slots);
  const priceCents = Math.max(listCents, losers[0]?.cents ?? listCents);
  return { winners, losers, priceCents };
}
