// Prices on Dishloopr are shown excluding VAT; Checkout adds 21% Dutch VAT on top, shown as its
// own line on the payment page and the invoice. The fixed rate is a Stripe Tax Rate that is
// looked up (or created once) by its metadata, so no dashboard setup is needed. Set
// STRIPE_VAT_RATE_ID to pin a specific rate. When Stripe Tax is switched on
// (STRIPE_AUTOMATIC_TAX=true, see billing.ts) Stripe calculates VAT itself and this adds nothing.

export const VAT_PERCENT = 21;

interface TaxRateApi {
  taxRates: {
    list(p: { active: boolean; limit: number }): Promise<{ data: { id: string; percentage: number; inclusive: boolean; metadata?: Record<string, string> | null }[] }>;
    create(p: Record<string, unknown>): Promise<{ id: string }>;
  };
}

let cachedRateId: string | null = null;

export async function vatRateId(stripe: TaxRateApi): Promise<string> {
  const pinned = Deno.env.get("STRIPE_VAT_RATE_ID");
  if (pinned) return pinned;
  if (cachedRateId) return cachedRateId;
  const { data } = await stripe.taxRates.list({ active: true, limit: 100 });
  const found = data.find(r => r.metadata?.dishloopr === "vat21" && r.percentage === VAT_PERCENT && !r.inclusive);
  cachedRateId = found?.id ?? (await stripe.taxRates.create({
    display_name: "Btw", description: "Nederlandse btw 21%", percentage: VAT_PERCENT, inclusive: false,
    country: "NL", jurisdiction: "NL", tax_type: "vat", metadata: { dishloopr: "vat21" },
  })).id;
  return cachedRateId;
}

/** Adds the 21% VAT rate to every line item of a Checkout Session, unless Stripe Tax is on. */
export async function withVat<T extends { line_items?: Record<string, unknown>[]; automatic_tax?: { enabled: boolean } }>(
  stripe: unknown, params: T,
): Promise<T> {
  if (params.automatic_tax?.enabled || !params.line_items?.length) return params;
  const id = await vatRateId(stripe as TaxRateApi);
  return { ...params, line_items: params.line_items.map(li => ({ ...li, tax_rates: [id] })) };
}
