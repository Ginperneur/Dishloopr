// City lists: the 7 largest cities first (by population, CBS 2024), then the rest alphabetically.
// Typing filters the list: names that start with the typed text come before names that contain it.

export const LARGEST_CITY_SLUGS = ['amsterdam', 'rotterdam', 'den-haag', 'utrecht', 'eindhoven', 'groningen', 'tilburg'];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '').trim();

export function sortCities<T extends { name: string; slug?: string | null }>(cities: T[]): T[] {
  const rank = (c: T) => {
    const i = LARGEST_CITY_SLUGS.indexOf(c.slug ?? norm(c.name).replace(/\s+/g, '-'));
    return i === -1 ? LARGEST_CITY_SLUGS.length : i;
  };
  return [...cities].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'nl'));
}

/** Filters an already sorted list; keeps its order within "starts with" and "contains". */
export function filterCities<T extends { name: string }>(cities: T[], query: string): T[] {
  const q = norm(query);
  if (!q) return cities;
  const starts: T[] = [];
  const contains: T[] = [];
  for (const c of cities) {
    const n = norm(c.name);
    // "Den Haag" also matches "haag", "s-Hertogenbosch" also matches "hertogenbosch"
    if (n.startsWith(q) || n.split(/[\s-]+/).some(w => w.startsWith(q))) starts.push(c);
    else if (n.includes(q)) contains.push(c);
  }
  return [...starts, ...contains];
}
