import { releasePaidEvent } from "../functions/_shared/eventPayment.ts";
import { strict as assert } from "node:assert";

const subscription = { id: "sub_event", metadata: { type: "event_promotion", event_id: "event_1", restaurant_id: "restaurant_1" }, items: { data: [{ current_period_end: 1800000000 }] } };
let row: Record<string, unknown> = { id: "event_1", restaurant_id: "restaurant_1", promotion_status: "unpaid", released_at: null, is_active: false };
let fail = false;
const client = { from(table: string) {
  assert.equal(table, "restaurant_events");
  return { update(values: Record<string, unknown>) {
    const filters: [string, unknown][] = [];
    const apply = () => {
      if (fail) return { data: null, error: { message: "write failed" } };
      const matches = filters.every(([key, value]) => row[key] === value);
      if (matches) row = { ...row, ...values };
      return { data: matches ? { id: row.id } : null, error: null };
    };
    const query = {
      eq(key: string, value: unknown) { filters.push([key, value]); return query; },
      is(key: string, value: unknown) { filters.push([key, value]); return Promise.resolve(apply()); },
      select() { return { maybeSingle: async () => apply() }; },
    };
    return query;
  } };
} };

await releasePaidEvent(client, subscription);
assert.equal(row.promotion_status, "paid");
assert.equal(row.stripe_subscription_id, "sub_event");
assert.equal(row.paid_until, "2027-01-15T08:00:00.000Z");
assert.equal(typeof row.released_at, "string");
console.log("PASS confirmed payment releases the event");
assert.equal(row.is_active, false);
console.log("PASS owner pause is preserved");
const firstRelease = row.released_at;
await releasePaidEvent(client, subscription);
assert.equal(row.released_at, firstRelease);
console.log("PASS duplicate payment preserves release timestamp");
await assert.rejects(releasePaidEvent(client, { ...subscription, metadata: { ...subscription.metadata, restaurant_id: "other" } }), /not found/);
console.log("PASS wrong restaurant cannot release an event");
fail = true;
await assert.rejects(releasePaidEvent(client, subscription), /write failed/);
console.log("PASS write failure propagates for Stripe retry");