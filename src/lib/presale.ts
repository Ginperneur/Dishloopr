export const PRESALE_STATUSES = ['nieuw', 'gemaild', 'gebeld', 'geclaimd', 'gereserveerd', 'betaald', 'nee'] as const;
export type PresaleStatus = typeof PRESALE_STATUSES[number];
export interface PresaleTarget {
  id: number; restaurant_id: string; pagina_slug: string; stad: string | null;
  gerecht: string | null; positie: number | null; totaal: number | null;
  status: string; notitie: string | null; updated_at: string | null;
}
export interface PresaleRestaurant { id: string; name: string; slug: string; phone: string | null; claimed_by_owner_id?: string | null }
export interface PresaleContact { restaurant_id: string; email: string | null; email_kwaliteit: string | null; instagram: string | null; telefoon_site?: string | null }
export interface PresaleGroup {
  id: string; restaurant: PresaleRestaurant | undefined; contact: PresaleContact | undefined;
  cities: string[]; pages: PresaleTarget[]; pageCount: number; bestPosition: number | null;
  status: string; note: string;
}
export function groupPresale(targets: PresaleTarget[], restaurants: PresaleRestaurant[], contacts: PresaleContact[]): PresaleGroup[] {
  const restaurantMap = new Map(restaurants.map(r => [r.id, r]));
  const contactMap = new Map(contacts.map(c => [c.restaurant_id, c]));
  const buckets = new Map<string, PresaleTarget[]>();
  for (const row of targets) buckets.set(row.restaurant_id, [...(buckets.get(row.restaurant_id) ?? []), row]);
  return Array.from(buckets, ([id, rows]) => {
    const latest = [...rows].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '') || b.id - a.id)[0];
    const pages = Array.from(new Map([...rows].sort((a, b) => (a.positie ?? Infinity) - (b.positie ?? Infinity)).map(r => [r.pagina_slug, r])).values());
    const positions = rows.flatMap(r => r.positie === null ? [] : [r.positie]);
    return { id, restaurant: restaurantMap.get(id), contact: contactMap.get(id),
      cities: [...new Set(rows.flatMap(r => r.stad ? [r.stad] : []))].sort(), pages,
      pageCount: pages.length, bestPosition: positions.length ? Math.min(...positions) : null,
      status: latest?.status ?? 'nieuw', note: latest?.notitie ?? '' };
  }).sort((a, b) => b.pageCount - a.pageCount || (a.bestPosition ?? Infinity) - (b.bestPosition ?? Infinity) || a.id.localeCompare(b.id));
}
export function filterPresale(groups: PresaleGroup[], filters: { city: string; status: string; threePlus: boolean; hasEmail: boolean; search?: string }) {
  const q = (filters.search ?? '').trim().toLowerCase();
  return groups.filter(g => (!q || (g.restaurant?.name ?? '').toLowerCase().includes(q)) && (filters.city === 'all' || g.cities.includes(filters.city)) &&
    (filters.status === 'all' || g.status === filters.status) && (!filters.threePlus || g.pageCount >= 3) &&
    (!filters.hasEmail || Boolean(g.contact?.email?.trim())));
}
export function presaleCounts(groups: PresaleGroup[]) {
  return Object.fromEntries(PRESALE_STATUSES.map(status => [status, groups.filter(g => g.status === status).length])) as Record<PresaleStatus, number>;
}
export function presaleUpdate(patch: { status?: PresaleStatus; notitie?: string }, now = new Date()) {
  return { ...patch, updated_at: now.toISOString() };
}
export function csvCell(value: unknown) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
export function presaleCsv(groups: PresaleGroup[]) {
  const headers = ['Restaurant', 'Restaurant-URL', 'Stad', "Aantal pagina's", 'Beste positie', 'Gerechtpagina’s', 'E-mail', 'E-mailkwaliteit', 'Instagram', 'Telefoon', 'Status', 'Notitie'];
  return '\uFEFF' + [headers, ...groups.map(g => [g.restaurant?.name ?? g.id,
    g.restaurant ? `https://dishloopr.com/restaurant/${g.restaurant.slug}` : '', g.cities.join(', '), g.pageCount,
    g.bestPosition, g.pages.map(p => `${p.gerecht ?? p.pagina_slug} #${p.positie ?? '—'} (${p.pagina_slug})`).join('; '),
    g.contact?.email, g.contact?.email_kwaliteit, g.contact?.instagram, g.restaurant?.phone, g.status, g.note])]
    .map(row => row.map(csvCell).join(',')).join('\r\n');
}
export interface PresaleRow extends PresaleTarget { restaurant?: PresaleRestaurant; contact?: PresaleContact }
export function presaleRows(targets: PresaleTarget[], restaurants: PresaleRestaurant[], contacts: PresaleContact[]): PresaleRow[] {
  const rm = new Map(restaurants.map(r => [r.id, r])); const cm = new Map(contacts.map(c => [c.restaurant_id, c]));
  return targets.map(t => ({ ...t, restaurant: rm.get(t.restaurant_id), contact: cm.get(t.restaurant_id) }))
    .sort((a, b) => (a.positie ?? Infinity) - (b.positie ?? Infinity) || (a.totaal ?? 0) - (b.totaal ?? 0) || a.id - b.id);
}
export function filterRows(rows: PresaleRow[], f: { city: string; status: string; search: string }) {
  const q = f.search.trim().toLowerCase();
  return rows.filter(r => (f.city === 'all' || r.stad === f.city) && (f.status === 'all' || r.status === f.status)
    && (!q || (r.restaurant?.name ?? '').toLowerCase().includes(q)));
}
export function rowStatusCounts(rows: { status: string }[]) {
  return Object.fromEntries(PRESALE_STATUSES.map(s => [s, rows.filter(r => r.status === s).length])) as Record<PresaleStatus, number>;
}
export function cityCounts(rows: { stad: string | null }[]) {
  const m = new Map<string, number>();
  for (const r of rows) if (r.stad) m.set(r.stad, (m.get(r.stad) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'nl'));
}
export function contactPhone(r: { restaurant?: PresaleRestaurant; contact?: PresaleContact }) {
  return r.contact?.telefoon_site?.trim() || r.restaurant?.phone?.trim() || '';
}
export function rowsCsv(rows: PresaleRow[]) {
  const headers = ['Restaurant', 'Restaurant-URL', 'Stad', 'Gerecht', 'Pagina-URL', 'Positie', 'Totaal', 'Telefoon', 'E-mail', 'Al geclaimd', 'Status', 'Notitie'];
  return '\uFEFF' + [headers, ...rows.map(r => [r.restaurant?.name ?? r.restaurant_id,
    r.restaurant ? `https://dishloopr.com/restaurant/${r.restaurant.slug}` : '', r.stad, r.gerecht,
    `https://dishloopr.com/eten/${r.pagina_slug}`, r.positie, r.totaal, contactPhone(r), r.contact?.email,
    r.restaurant?.claimed_by_owner_id ? 'ja' : 'nee', r.status, r.notitie])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
