import { periodEndIso } from "./stripePeriod.ts";

type EventSubscription = Parameters<typeof periodEndIso>[0] & {
  id: string;
  metadata: Record<string, string>;
};

/** Only invoke after Stripe has confirmed payment, never from a browser redirect. */
export async function releasePaidEvent(
  client: { from: (table: string) => any },
  subscription: EventSubscription,
) {
  const { event_id, restaurant_id, type } = subscription.metadata;
  if (type !== "event_promotion" || !event_id || !restaurant_id) return;
  const { data, error } = await client.from("restaurant_events")
    .update({
      promotion_status: "paid",
      stripe_subscription_id: subscription.id,
      paid_until: periodEndIso(subscription),
    })
    .eq("id", event_id).eq("restaurant_id", restaurant_id)
    .select("id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Paid event not found for this restaurant");
  // Preserve the first release timestamp when Stripe retries or renews a payment.
  const { error: releaseError } = await client.from("restaurant_events")
    .update({ released_at: new Date().toISOString(), released_by: null })
    .eq("id", event_id).eq("restaurant_id", restaurant_id).is("released_at", null);
  if (releaseError) throw new Error(releaseError.message);
}