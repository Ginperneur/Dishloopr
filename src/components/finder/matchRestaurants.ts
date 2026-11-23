import { supabase } from '@/integrations/supabase/client';
import { FOOD_CATEGORIES, pickTop, tally, type Candidate } from '@/lib/foodMatch';

export interface MatchResult { id: string; name: string; slug: string; image: string | null; rating: number | null; ambienceTags: string[]; reasons: string[] }

export async function matchRestaurants(cityId: string, dishLists: string[][], ambLists: string[][]): Promise<MatchResult[]> {
  const dishVotes = tally(dishLists);
  const ambVotes = tally(ambLists);
  const cats = FOOD_CATEGORIES.filter((c) => dishVotes[c.id]);
  const hits = new Map<string, Set<string>>();
  await Promise.all(cats.flatMap((cat) => cat.terms.map(async (term) => {
    const { data } = await supabase.rpc('search_restaurants', { p_term: term, p_city_id: cityId, p_limit: 80 });
    (data ?? []).forEach((r) => {
      if (!hits.has(r.restaurant_id)) hits.set(r.restaurant_id, new Set());
      hits.get(r.restaurant_id)!.add(cat.id);
    });
  })));
  let ids = [...hits.keys()];
  if (ids.length === 0) {
    const { data } = await supabase.from('restaurants').select('id').eq('city_id', cityId).eq('is_active', true)
      .not('google_rating', 'is', null).order('google_rating', { ascending: false }).limit(80);
    ids = (data ?? []).map((r) => r.id);
  }
  if (ids.length === 0) return [];
  const rows: { id: string; name: string; slug: string; images: string[] | null; ambience_tags: string[] | null; google_rating: number | null }[] = [];
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from('restaurants').select('id,name,slug,images,ambience_tags,google_rating')
      .in('id', ids.slice(i, i + 150)).eq('is_active', true);
    rows.push(...((data ?? []) as typeof rows));
  }
  const cands: Candidate[] = rows.map((r) => ({ id: r.id, categoryHits: hits.get(r.id) ?? new Set(), ambienceTags: r.ambience_tags ?? [], rating: r.google_rating }));
  const top = pickTop(cands, dishVotes, ambVotes, 2);
  return top.map((c) => {
    const r = rows.find((x) => x.id === c.id)!;
    const reasons = [
      ...FOOD_CATEGORIES.filter((f) => c.categoryHits.has(f.id)).map((f) => `${f.emoji} ${f.label}`),
      ...c.ambienceTags.filter((t) => ambVotes[t]).map((t) => t),
    ];
    return { id: r.id, name: r.name, slug: r.slug, image: r.images?.[0] ?? null, rating: r.google_rating, ambienceTags: r.ambience_tags ?? [], reasons };
  });
}
