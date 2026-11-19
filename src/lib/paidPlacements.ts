import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { IMPRESSION_THRESHOLD, METRIC_INTERVAL_MS, metricBatches } from './metricRules';

/**
 * Paid places, one source for every surface (page_paid_placements and friends in the database).
 * A page sells 1 Topplek and 3 Uitgelicht; search shows at most 1 Topplek and 2 Uitgelicht above
 * the results. Paid places never change the organic order below them.
 */
export type PaidKind = 'topplek' | 'uitgelicht';
export type PaidSurface = 'gerechtpagina' | 'zoeken' | 'kaart' | 'homepage' | 'badge' | 'spotlight';

export interface PagePlacement { restaurant_id: string; kind: PaidKind; is_founding: boolean }
export interface SearchPlacement { restaurant_id: string; kind: PaidKind; page_slug: string }
export interface PaidBadge { page_slug: string; kind: PaidKind; subject: string; city_name: string; is_founding: boolean }
export interface CityPage { page_slug: string; page_kind: 'dish' | 'cuisine' | 'ambience'; subject: string; restaurant_count: number }
export interface CityTopplek extends CityPage { restaurant_id: string }
export interface SpotlightItem { restaurant_id: string; headline: string; body: string }

export const PAID_EXPLAINED_PATH = '/betaalde-plekken';
export const SEARCH_PAID_LIMIT = { topplek: 1, uitgelicht: 2 } as const;

const rpc = (name: string, args: Record<string, unknown>) => (supabase.rpc as any)(name, args);
async function rows<T>(name: string, args: Record<string, unknown>): Promise<T[]> {
  const { data, error } = await rpc(name, args);
  if (error) throw error;
  return (data ?? []) as T[];
}

export function usePagePlacements(pageSlug: string | undefined | null) {
  return useQuery({
    queryKey: ['paid-page', pageSlug],
    queryFn: () => rows<PagePlacement>('page_paid_placements', { p_page_slug: pageSlug }),
    enabled: Boolean(pageSlug), staleTime: 60_000,
  });
}

export function useRestaurantBadges(restaurantId: string | undefined | null) {
  return useQuery({
    queryKey: ['paid-badges', restaurantId],
    queryFn: () => rows<PaidBadge>('restaurant_paid_badges', { p_restaurant: restaurantId }),
    enabled: Boolean(restaurantId), staleTime: 60_000,
  });
}

export function useCityPages(cityId: string | undefined | null) {
  return useQuery({
    queryKey: ['city-pages', cityId],
    queryFn: () => rows<CityPage>('city_landing_pages', { p_city: cityId }),
    enabled: Boolean(cityId), staleTime: 5 * 60_000,
  });
}

export function useCityToppleks(cityId: string | undefined | null) {
  return useQuery({
    queryKey: ['city-toppleks', cityId],
    queryFn: () => rows<CityTopplek>('city_toppleks', { p_city: cityId }),
    enabled: Boolean(cityId), staleTime: 60_000,
  });
}

export function useCitySpotlight(cityId: string | undefined | null) {
  return useQuery({
    queryKey: ['city-spotlight', cityId],
    queryFn: () => rows<SpotlightItem>('city_spotlight', { p_city: cityId }),
    enabled: Boolean(cityId), staleTime: 60_000,
  });
}

export function fetchSearchPlacements(cityId: string, dishIds: string[], cuisine?: string | null) {
  return rows<SearchPlacement>('search_paid_placements', { p_city: cityId, p_dish_ids: dishIds, p_cuisine: cuisine ?? null });
}

/** At most 1 Topplek and 2 Uitgelicht, Topplek first; the order within Uitgelicht comes from the database. */
export function pickSearchPlacements<T extends { kind: PaidKind }>(list: T[]): T[] {
  const top = list.filter(p => p.kind === 'topplek').slice(0, SEARCH_PAID_LIMIT.topplek);
  const uit = list.filter(p => p.kind === 'uitgelicht').slice(0, SEARCH_PAID_LIMIT.uitgelicht);
  return [...top, ...uit];
}

/** "Topplek voor pizza in Utrecht" / "Uitgelicht voor Italiaans eten in Utrecht". */
export function badgeText(b: Pick<PaidBadge, 'kind' | 'subject' | 'city_name'>): string {
  return `${b.kind === 'topplek' ? 'Topplek' : 'Uitgelicht'} voor ${b.subject} in ${b.city_name}`;
}

// --- Anonymous counters per surface (track_paid_metrics), batched like the other counters ---
type Item = { r: string; p: string; s: PaidSurface; m: 'impressie' | 'klik' };
let pending: Item[] = [];
let timer: ReturnType<typeof setInterval> | undefined;

export function flushPaidMetrics(keepalive = false): void {
  const items = pending;
  pending = [];
  for (const batch of metricBatches(items)) {
    if (keepalive) {
      void fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/track_paid_metrics`, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ p_items: batch }),
      }).catch(() => {});
    } else {
      void Promise.resolve(rpc('track_paid_metrics', { p_items: batch })).catch(() => {});
    }
  }
}

export function trackPaidMetric(restaurantId: string, pageSlug: string, surface: PaidSurface, m: 'impressie' | 'klik'): void {
  pending.push({ r: restaurantId, p: pageSlug, s: surface, m });
  if (!timer) {
    timer = setInterval(() => flushPaidMetrics(), METRIC_INTERVAL_MS);
    window.addEventListener('pagehide', () => flushPaidMetrics(true));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPaidMetrics(true); });
  }
}

/** One impression per mounted paid card once at least half of it was on screen. */
export function usePaidImpression<T extends Element>(restaurantId: string, pageSlug: string, surface: PaidSurface) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !pageSlug || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(en => en.isIntersecting && en.intersectionRatio >= IMPRESSION_THRESHOLD)) {
        trackPaidMetric(restaurantId, pageSlug, surface, 'impressie');
        observer.disconnect();
      }
    }, { threshold: IMPRESSION_THRESHOLD });
    observer.observe(el);
    return () => observer.disconnect();
  }, [restaurantId, pageSlug, surface]);
  return ref;
}
