import { expect, test } from 'bun:test';
import { metricBatches, IMPRESSION_THRESHOLD, METRIC_INTERVAL_MS, summarizeMetrics, safeSearchTerm, type MetricItem } from '../src/lib/metricRules';
import { initializeCookieAnalytics, chooseCookies, sendAnalyticsEvent } from '../src/lib/cookieConsent';

test('batches never exceed 60 counters', () => {
  const items: MetricItem[] = Array.from({ length: 125 }, () => ({ r: 'id', m: 'impressie', c: 'ramen' }));
  expect(metricBatches(items).map(b => b.length)).toEqual([60, 60, 5]);
});
test('impressions require 50 percent visibility', () => { expect(IMPRESSION_THRESHOLD).toBe(0.5); });
test('counter flush interval is three seconds', () => { expect(METRIC_INTERVAL_MS).toBe(3000); });
test('top five dishes uses impression counts and excludes generic contexts', () => {
  const result = summarizeMetrics([{ metric: 'bekeken', context: 'ramen', totaal: 3 }, { metric: 'impressie', context: 'zoek', totaal: 90 }, ...Array.from({ length: 6 }, (_, i) => ({ metric: 'impressie', context: `dish-${i}`, totaal: i + 1 }))]);
  expect(result.totalViews).toBe(3);
  expect(result.topDishes.map(d => d.count)).toEqual([6, 5, 4, 3, 2]);
  expect(result.impressions).toBe(111);
});
test('search terms containing contact details are not sent to GA', () => {
  expect(safeSearchTerm('a@example.com')).toBe('');
  expect(safeSearchTerm('0612345678')).toBe('');
  expect(safeSearchTerm('ramen')).toBe('ramen');
});
test('GA events are absent without consent and queued only after accepting', () => {
  const values = new Map<string, string>();
  Object.assign(globalThis, { window: { dataLayer: [] }, localStorage: { getItem: (k: string) => values.get(k) || null, setItem: (k: string, v: string) => values.set(k, v) }, location: { hostname: 'localhost', pathname: '/search' }, document: { cookie: '', createElement: () => ({}), head: { appendChild: () => {} } } });
  initializeCookieAnalytics('G-TEST123');
  sendAnalyticsEvent('search', { search_term: 'ramen' });
  const queued = () => (window as unknown as { dataLayer: IArguments[] }).dataLayer.filter(v => v[0] === 'event');
  expect(queued().length).toBe(0);
  chooseCookies('accepted');
  sendAnalyticsEvent('search', { search_term: 'ramen' });
  expect(queued().length).toBe(1);
  expect(queued()[0][2]).toMatchObject({ debug_mode: true, search_term: 'ramen' });
});