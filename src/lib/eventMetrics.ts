import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { IMPRESSION_THRESHOLD, METRIC_INTERVAL_MS, metricBatches } from './metricRules';

export type EventMetric = 'impressie' | 'bekeken' | 'klik';
type EventMetricItem = { e: string; m: EventMetric };

let pending: EventMetricItem[] = [];
let timer: ReturnType<typeof setInterval> | undefined;

/** Batches anonymous counters to track_event_metrics, same flow as restaurantMetrics. */
export function flushEventMetrics(keepalive = false): void {
  const items = pending;
  pending = [];
  for (const batch of metricBatches(items)) {
    if (keepalive) {
      void fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/track_event_metrics`, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ p_items: batch }),
      }).catch(() => {});
    } else {
      void Promise.resolve(supabase.rpc('track_event_metrics', { p_items: batch })).catch(() => {});
    }
  }
}

export function trackEventMetric(e: string, m: EventMetric): void {
  pending.push({ e, m });
  if (!timer) {
    timer = setInterval(() => flushEventMetrics(), METRIC_INTERVAL_MS);
    window.addEventListener('pagehide', () => flushEventMetrics(true));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushEventMetrics(true); });
  }
}

/** Counts one impression per mounted card once at least half of it was on screen. */
export function useEventImpression<T extends Element>(eventId: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(en => en.isIntersecting && en.intersectionRatio >= IMPRESSION_THRESHOLD)) {
        trackEventMetric(eventId, 'impressie');
        observer.disconnect();
      }
    }, { threshold: IMPRESSION_THRESHOLD });
    observer.observe(el);
    return () => observer.disconnect();
  }, [eventId]);
  return ref;
}
