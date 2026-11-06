import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { IMPRESSION_THRESHOLD, METRIC_INTERVAL_MS, metricBatches } from './metricRules';

export type FoundingMetric = 'impressie' | 'klik';
type FoundingMetricItem = { r: string; p: string; m: FoundingMetric };

let pending: FoundingMetricItem[] = [];
let timer: ReturnType<typeof setInterval> | undefined;

/** Batches anonymous counters to track_founding_metrics, same flow as eventMetrics. */
export function flushFoundingMetrics(keepalive = false): void {
  const items = pending;
  pending = [];
  for (const batch of metricBatches(items)) {
    if (keepalive) {
      void fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/track_founding_metrics`, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ p_items: batch }),
      }).catch(() => {});
    } else {
      void Promise.resolve((supabase.rpc as any)('track_founding_metrics', { p_items: batch })).catch(() => {});
    }
  }
}

export function trackFoundingMetric(restaurantId: string, pageSlug: string, m: FoundingMetric): void {
  pending.push({ r: restaurantId, p: pageSlug, m });
  if (!timer) {
    timer = setInterval(() => flushFoundingMetrics(), METRIC_INTERVAL_MS);
    window.addEventListener('pagehide', () => flushFoundingMetrics(true));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushFoundingMetrics(true); });
  }
}

/** Counts one impression per mounted "Uitgelicht" card once at least half of it was on screen. */
export function useFoundingImpression<T extends Element>(restaurantId: string, pageSlug: string) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(en => en.isIntersecting && en.intersectionRatio >= IMPRESSION_THRESHOLD)) {
        trackFoundingMetric(restaurantId, pageSlug, 'impressie');
        observer.disconnect();
      }
    }, { threshold: IMPRESSION_THRESHOLD });
    observer.observe(el);
    return () => observer.disconnect();
  }, [restaurantId, pageSlug]);
  return ref;
}
