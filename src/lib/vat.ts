// Prices on Dishloopr are shown excluding VAT. Checkout adds 21% Dutch VAT on top
// (supabase/functions/_shared/vat.ts), so what an owner pays is excl + VAT.

export const VAT_RATE = 0.21;
export const EX_VAT = 'excl. btw';

/** VAT on an amount in cents, rounded to whole cents like Stripe does. */
export const vatCents = (exCents: number) => Math.round(exCents * VAT_RATE);
export const inclVatCents = (exCents: number) => exCents + vatCents(exCents);

const fmt = (cents: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

/** "€59 + €12,39 btw = €71,39" */
export function vatBreakdown(exCents: number): string {
  return `${fmt(exCents)} + ${fmt(vatCents(exCents))} btw = ${fmt(inclVatCents(exCents))}`;
}
