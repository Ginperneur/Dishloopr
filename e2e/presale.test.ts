import { expect, test } from 'bun:test';
import { groupPresale, filterPresale, presaleCounts, presaleUpdate, csvCell, PRESALE_STATUSES, type PresaleTarget } from '../src/lib/presale';
const row = (id: number, restaurant_id: string, positie: number, stad = 'Amsterdam'): PresaleTarget => ({ id, restaurant_id, pagina_slug: `pizza-${id}`, stad, gerecht: 'Pizza', positie, totaal: 10, status: 'nieuw', notitie: null, updated_at: null });
const groups = () => groupPresale([row(1, 'a', 2), row(2, 'a', 2), row(3, 'a', 3), row(4, 'b', 1), row(5, 'c', 2, 'Rotterdam')], [], [{ restaurant_id: 'a', email: 'a@example.com', email_kwaliteit: 'goed', instagram: null }]);
test('groups per restaurant and sorts by page count then best position', () => {
  expect(groups().map(g => [g.id, g.pageCount, g.bestPosition])).toEqual([['a', 3, 2], ['b', 1, 1], ['c', 1, 2]]);
});
test('3+ pages filter includes three and excludes one', () => {
  expect(filterPresale(groups(), { city: 'all', status: 'all', threePlus: true, hasEmail: false }).map(g => g.id)).toEqual(['a']);
});
test('email filter excludes restaurants without an email', () => {
  expect(filterPresale(groups(), { city: 'all', status: 'all', threePlus: false, hasEmail: true }).map(g => g.id)).toEqual(['a']);
});
test('city and status filters both apply', () => {
  expect(filterPresale(groups(), { city: 'Rotterdam', status: 'nieuw', threePlus: false, hasEmail: false }).map(g => g.id)).toEqual(['c']);
  expect(filterPresale(groups(), { city: 'Rotterdam', status: 'betaald', threePlus: false, hasEmail: false })).toEqual([]);
});
test('counters count restaurants not target rows', () => { expect(presaleCounts(groups()).nieuw).toBe(3); });
test('status choices are exactly the seven requested values', () => { expect([...PRESALE_STATUSES]).toEqual(['nieuw', 'gemaild', 'gebeld', 'geclaimd', 'gereserveerd', 'betaald', 'nee']); });
test('each update sets updated_at', () => { expect(presaleUpdate({ status: 'gemaild', notitie: 'Bel morgen' }, new Date('2026-10-22T17:37:00Z'))).toEqual({ status: 'gemaild', notitie: 'Bel morgen', updated_at: '2026-10-22T17:37:00.000Z' }); });
test('CSV neutralizes all four formula prefixes and escapes quotes', () => {
  expect(['=SUM(1)', '+1', '-1', '@cmd'].map(csvCell)).toEqual(["'=SUM(1)", "'+1", "'-1", "'@cmd"]);
  expect(csvCell('a,"b"')).toBe('"a,""b"""');
});
import { presaleRows, filterRows, cityCounts } from '../src/lib/presale';
test('per-page rows sort by position and filter by name', () => {
  const t = (id: number, positie: number, stad: string, rid: string) => ({ id, restaurant_id: rid, pagina_slug: `p${id}`, stad, gerecht: 'x', positie, totaal: 10, status: 'nieuw', notitie: null, updated_at: null });
  const rows = presaleRows([t(1, 5, 'Breda', 'a'), t(2, 1, 'Tilburg', 'b')], [{ id: 'a', name: 'Alfa', slug: 'alfa', phone: null }, { id: 'b', name: 'Beta', slug: 'beta', phone: null }], []);
  expect(rows.map(r => r.id)).toEqual([2, 1]);
  expect(filterRows(rows, { city: 'all', status: 'all', search: 'alf' }).map(r => r.id)).toEqual([1]);
  expect(cityCounts(rows)).toEqual([['Breda', 1], ['Tilburg', 1]]);
});
