// Anonymous reservation-funnel counters (no browser identifiers, no guest data).
// Clicks keep going through trackRestaurantMetric('reserveren'); this only adds the
// later stages so owners see started flows separately from confirmed bookings.
import { supabase } from '@/integrations/supabase/client';

export type FunnelStage = 'flow_started' | 'widget_opened' | 'widget_booking_reported';

const sent = new Set<string>();

/** Counts each stage once per restaurant per page load (and each reported booking once). */
export function funnelKey(restaurantId: string, stage: FunnelStage, extra = ''): string {
  return `${restaurantId}|${stage}|${extra}`;
}

export function trackReservationFunnel(restaurantId: string, stage: FunnelStage, context: string, dedupe = ''): void {
  const key = funnelKey(restaurantId, stage, dedupe);
  if (sent.has(key)) return;
  sent.add(key);
  const rpc = supabase.rpc as unknown as (fn: string, args: unknown) => PromiseLike<unknown>;
  Promise.resolve(rpc('track_reservation_funnel', { p_items: [{ r: restaurantId, s: stage, c: context }] })).catch(() => undefined);
}
