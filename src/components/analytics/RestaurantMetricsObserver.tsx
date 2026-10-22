import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { IMPRESSION_THRESHOLD, metricContext, type RestaurantMetric } from '@/lib/metricRules';
import { flushRestaurantMetrics, trackRestaurantMetric } from '@/lib/restaurantMetrics';
import { sendAnalyticsEvent } from '@/lib/cookieConsent';

/** Observes actual visibility, including cards added after paging or map popups. */
export function RestaurantMetricsObserver() {
  const location = useLocation();
  useEffect(() => {
    const seen = new Set<string>();
    const observed = new WeakSet<Element>();
    const context = () => document.querySelector<HTMLElement>('[data-metric-context]')?.dataset.metricContext || metricContext(location.pathname, location.search);
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const id = el.dataset.restaurantId;
        if (!id || !entry.isIntersecting || entry.intersectionRatio < IMPRESSION_THRESHOLD || seen.has(id)) continue;
        seen.add(id);
        trackRestaurantMetric(id, 'impressie', context());
      }
    }, { threshold: IMPRESSION_THRESHOLD });
    const scan = () => {
      document.querySelectorAll('[data-restaurant-id]').forEach(el => {
        if (!observed.has(el)) { observed.add(el); observer.observe(el); }
      });
    };
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.getElementById('root') || document.body, { childList: true, subtree: true });
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const card = target?.closest<HTMLElement>('[data-restaurant-id]');
      const link = target?.closest<HTMLAnchorElement>('a[href]');
      if (card && link?.getAttribute('href')?.startsWith('/restaurant/')) {
        sendAnalyticsEvent('select_restaurant', { restaurant_slug: link.getAttribute('href')?.split('/')[2] || '', position: Number(card.dataset.position || 1), list: location.pathname });
      }
      // Covers secondary contact links that aren't wired to the primary CTA callback.
      const profile = target?.closest<HTMLElement>('[data-restaurant-profile]');
      if (profile) {
        const href = link?.getAttribute('href') || '';
        let metric: RestaurantMetric | undefined;
        if (href.startsWith('tel:')) metric = 'telefoon';
        else if (/google\.com\/maps\/(dir|search)/.test(href)) metric = 'route';
        if (metric) {
          trackRestaurantMetric(profile.dataset.restaurantProfile || '', metric, profile.dataset.metricContext || 'zoek');
          sendAnalyticsEvent(metric === 'telefoon' ? 'click_phone' : 'click_route', { restaurant_slug: profile.dataset.restaurantSlug || '' });
        }
      }
    };
    document.addEventListener('click', click, true);
    return () => { observer.disconnect(); mutations.disconnect(); document.removeEventListener('click', click, true); flushRestaurantMetrics(true); };
  }, [location.key, location.pathname, location.search]);
  return null;
}