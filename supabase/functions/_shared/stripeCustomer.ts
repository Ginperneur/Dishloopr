// One Stripe customer per Dishloopr user (table stripe_customers).
//
// Before, every checkout looked the customer up with `customers.list({ email, limit: 1 })`, and
// one-off payments created a new customer each time. The newest customer then had no Pro
// subscription, so the Pro status check switched paying owners' Pro off. Every checkout now
// passes this one customer, and status checks look across all customers of the user.
import type Stripe from "https://esm.sh/stripe@18.5.0";
// deno-lint-ignore no-explicit-any
type SupabaseClient = { from(table: string): any };

type User = { id: string; email?: string | null };

/** All Stripe customer ids that belong to this user: the stored one plus older ones with the same email. */
export async function customerIdsForUser(stripe: Stripe, admin: SupabaseClient, user: User): Promise<string[]> {
  const ids = new Set<string>();
  const { data } = await admin.from("stripe_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (data?.stripe_customer_id) ids.add(data.stripe_customer_id);
  if (user.email) {
    const list = await stripe.customers.list({ email: user.email, limit: 100 });
    for (const c of list.data) ids.add(c.id);
  }
  return [...ids];
}

/**
 * The user's Stripe customer, created once. With older duplicates, the one with a live
 * subscription wins, otherwise the oldest; the choice is stored so it never changes again.
 */
export async function getOrCreateCustomer(stripe: Stripe, admin: SupabaseClient, user: User): Promise<string> {
  const { data } = await admin.from("stripe_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  if (data?.stripe_customer_id) return data.stripe_customer_id;

  let chosen: string | null = null;
  if (user.email) {
    const list = await stripe.customers.list({ email: user.email, limit: 100 });
    const customers = [...list.data].sort((a, b) => a.created - b.created);
    for (const c of customers) {
      const subs = await stripe.subscriptions.list({ customer: c.id, status: "all", limit: 10 });
      if (subs.data.some((s: Stripe.Subscription) => ["active", "trialing", "past_due"].includes(s.status))) { chosen = c.id; break; }
    }
    chosen ??= customers[0]?.id ?? null;
  }
  if (!chosen) {
    const created = await stripe.customers.create({ email: user.email ?? undefined, metadata: { user_id: user.id } });
    chosen = created.id;
  }
  // Two parallel first checkouts: the first stored id wins and both use it.
  await admin.from("stripe_customers").upsert({ user_id: user.id, stripe_customer_id: chosen }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data: stored } = await admin.from("stripe_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
  return stored?.stripe_customer_id ?? chosen;
}

/** Live subscriptions of the user across all their customers. */
export async function liveSubscriptions(stripe: Stripe, customerIds: string[]): Promise<Stripe.Subscription[]> {
  const out: Stripe.Subscription[] = [];
  for (const id of customerIds) {
    const subs = await stripe.subscriptions.list({ customer: id, status: "all", limit: 100 });
    out.push(...subs.data.filter((s: Stripe.Subscription) => ["active", "trialing", "past_due"].includes(s.status)));
  }
  return out;
}

/**
 * Expires the user's still-open checkouts for the same product, so two tabs (or a back button)
 * can never end in two subscriptions for one event, tag or Pro.
 */
export async function expireOpenCheckouts(stripe: Stripe, customerId: string, same: (md: Record<string, string>) => boolean): Promise<void> {
  const open = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
  for (const s of open.data) {
    if (same((s.metadata ?? {}) as Record<string, string>)) await stripe.checkout.sessions.expire(s.id).catch(() => {});
  }
}
