export const METRIC_BATCH_SIZE = 60;
export const METRIC_INTERVAL_MS = 3000;
export const IMPRESSION_THRESHOLD = 0.5;
export type RestaurantMetric = 'impressie' | 'bekeken' | 'website' | 'telefoon' | 'route' | 'reserveren' | 'menu' | 'delen';
export type MetricItem = { r: string; m: RestaurantMetric; c: string };
export function metricBatches(items: MetricItem[]): MetricItem[][] {
  return Array.from({ length: Math.ceil(items.length / METRIC_BATCH_SIZE) }, (_, i) => items.slice(i * METRIC_BATCH_SIZE, (i + 1) * METRIC_BATCH_SIZE));
}
export function safeSearchTerm(value: string): string {
  if (/@|https?:|\+?\d[\d\s()-]{6,}/i.test(value)) return '';
  return value.trim().slice(0, 80);
}
export function metricContext(path: string, search = ''): string {
  if (path.startsWith('/eten/')) return path.split('/')[2] === 'gerecht' ? path.split('/')[3] || 'zoek' : path.split('/')[2] || 'zoek';
  if (path.startsWith('/steden/')) return 'stad';
  if (path.startsWith('/collection/')) return 'collectie';
  const term = safeSearchTerm(new URLSearchParams(search).get('dish') || new URLSearchParams(search).get('q') || '');
  return term ? term.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') : 'zoek';
}
export type SummaryRow = { metric: string; context: string; totaal: number | string };
export function summarizeMetrics(rows: SummaryRow[]) {
  const sum = (metric: string) => rows.filter(r => r.metric === metric).reduce((n, r) => n + Number(r.totaal), 0);
  const dishes = new Map<string, number>();
  for (const r of rows) {
    if (r.metric === 'impressie' && r.context && !['zoek', 'stad', 'collectie'].includes(r.context)) dishes.set(r.context, (dishes.get(r.context) || 0) + Number(r.totaal));
  }
  return { impressions: sum('impressie'), totalViews: sum('bekeken'), websiteClicks: sum('website'), phoneClicks: sum('telefoon'), routeClicks: sum('route'), reservationClicks: sum('reserveren'), totalClicks: ['website', 'telefoon', 'route', 'reserveren', 'menu', 'delen'].reduce((n, m) => n + sum(m), 0), topDishes: [...dishes].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([dish, count]) => ({ dish, count })), viewsByDay: [] as { date: string; count: number }[] };
}