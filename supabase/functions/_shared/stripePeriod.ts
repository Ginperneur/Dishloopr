// Since Stripe API 2025-03-31.basil the billing period lives on the subscription
// item, not the subscription. Reading `sub.current_period_end` gives undefined,
// and `new Date(NaN).toISOString()` throws, which failed the whole webhook.
type PeriodSource = {
  items?: { data?: Array<{ current_period_end?: number | null }> };
  current_period_end?: number | null;
};

export function periodEndIso(sub: PeriodSource): string | null {
  const seconds = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;
  return typeof seconds === "number" ? new Date(seconds * 1000).toISOString() : null;
}
