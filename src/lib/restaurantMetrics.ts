import { supabase } from '@/integrations/supabase/client';
import { metricBatches, METRIC_INTERVAL_MS, type MetricItem, type RestaurantMetric } from './metricRules';

let pending: MetricItem[] = [];
let timer: ReturnType<typeof setInterval> | undefined;
export function flushRestaurantMetrics(keepalive = false): void {
  const items = pending;
  pending = [];
  for (const batch of metricBatches(items)) {
    if (keepalive) {
      void fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/track_restaurant_metrics`, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ p_items: batch }),
      }).catch(() => {});
    } else {
      void Promise.resolve(supabase.rpc('track_restaurant_metrics' as never, { p_items: batch } as never)).catch(() => {});
    }
  }
}
export function trackRestaurantMetric(r: string, m: RestaurantMetric, c: string): void {
  pending.push({ r, m, c: c.slice(0, 80) });
  if (!timer) {
    timer = setInterval(() => flushRestaurantMetrics(), METRIC_INTERVAL_MS);
    window.addEventListener('pagehide', () => flushRestaurantMetrics(true));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushRestaurantMetrics(true); });
  }
}