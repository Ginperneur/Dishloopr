export interface FoodCategory { id: string; label: string; emoji: string; terms: string[] }

/** Invitations must be reachable outside the preview or native app. */
export function foodMatchShareUrl(code: string): string {
  return `https://dishloopr.com/food-match/${encodeURIComponent(code)}`;
}

export const FOOD_CATEGORIES: FoodCategory[] = [
  { id: 'vlees', label: 'Vlees', emoji: '🥩', terms: ['biefstuk', 'spareribs'] },
  { id: 'garnalen', label: 'Garnalen', emoji: '🍤', terms: ['garnalen'] },
  { id: 'vis', label: 'Vis', emoji: '🐟', terms: ['zalm', 'vis'] },
  { id: 'ramen', label: 'Ramen', emoji: '🍜', terms: ['ramen'] },
  { id: 'sushi', label: 'Sushi', emoji: '🍣', terms: ['sushi'] },
  { id: 'pizza', label: 'Pizza', emoji: '🍕', terms: ['pizza'] },
  { id: 'pasta', label: 'Pasta', emoji: '🍝', terms: ['pasta'] },
  { id: 'burger', label: 'Burger', emoji: '🍔', terms: ['hamburger'] },
  { id: 'curry', label: 'Curry', emoji: '🍛', terms: ['curry'] },
  { id: 'tacos', label: 'Tacos', emoji: '🌮', terms: ['taco'] },
  { id: 'poke', label: 'Poke bowl', emoji: '🥗', terms: ['poke bowl'] },
  { id: 'dessert', label: 'Dessert', emoji: '🍰', terms: ['tiramisu', 'cheesecake'] },
];

export const AMBIENCES = [
  { id: 'Gezellig', emoji: '🕯️' }, { id: 'Romantisch', emoji: '🌹' }, { id: 'Casual', emoji: '👟' },
  { id: 'Trendy', emoji: '✨' }, { id: 'Luxe', emoji: '🥂' }, { id: 'Levendig', emoji: '🎶' },
  { id: 'Traditioneel', emoji: '🏛️' }, { id: 'Kindvriendelijk', emoji: '🧸' },
];

export interface Candidate {
  id: string; categoryHits: Set<string>; ambienceTags: string[]; rating: number | null;
}

/** Score: dish-category votes across all participants (2 per vote) + ambience votes (1 per vote) + rating tiebreak. */
export function scoreCandidate(c: Candidate, dishVotes: Record<string, number>, ambVotes: Record<string, number>): number {
  let s = 0;
  c.categoryHits.forEach((cat) => { s += 2 * (dishVotes[cat] ?? 0); });
  const tags = new Set(c.ambienceTags.map((t) => t.toLowerCase()));
  for (const [a, n] of Object.entries(ambVotes)) if (tags.has(a.toLowerCase())) s += n;
  return s + (c.rating ?? 0) / 10;
}

export function tally(lists: string[][]): Record<string, number> {
  const out: Record<string, number> = {};
  lists.flat().forEach((x) => { out[x] = (out[x] ?? 0) + 1; });
  return out;
}

export function pickTop(cands: Candidate[], dishVotes: Record<string, number>, ambVotes: Record<string, number>, n = 2): Candidate[] {
  return [...cands]
    .map((c) => ({ c, s: scoreCandidate(c, dishVotes, ambVotes) }))
    .sort((a, b) => b.s - a.s || a.c.id.localeCompare(b.c.id))
    .slice(0, n).map((x) => x.c);
}
