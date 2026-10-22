export const PRESALE_STATUSES = ['nieuw', 'gemaild', 'gebeld', 'geclaimd', 'gereserveerd', 'betaald', 'nee'] as const;
export type PresaleStatus = typeof PRESALE_STATUSES[number];
export interface PresaleTarget {
  id: number; restaurant_id: string; pagina_slug: string; stad: string | null;
  gerecht: string | null; positie: number | null; totaal: number | null;
  status: string; notitie: string | null; updated_at: string | null;
}
export interface PresaleRestaurant { id: string; name: string; slug: string; phone: string | null }
export interface PresaleContact { restaurant_id: string; email: string | null; email_kwaliteit: string | null; instagram: string | null }
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
export function filterPresale(groups: PresaleGroup[], filters: { city: string; status: string; threePlus: boolean; hasEmail: boolean }) {
  return groups.filter(g => (filters.city === 'all' || g.cities.includes(filters.city)) &&
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