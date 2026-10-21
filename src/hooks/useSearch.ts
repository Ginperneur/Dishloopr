import { useState, useEffect, useCallback, useRef } from 'react';

type ParsedTerm = { term: string | null; city_id: string | null; city_name: string | null };
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  scoreRestaurant,
  sortResults,
  rebalanceSponsoredResults,
  bayesianRating,
  type ScoringContext,
  type DishMatchInfo,
} from '@/lib/ranking';
import { calculateDistance } from '@/hooks/useGeolocation';
import { getEmptyRestaurantIds } from '@/lib/listableRestaurants';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];
type Dish = Database['public']['Tables']['dishes']['Row'];
type City = Database['public']['Tables']['cities']['Row'];

export interface SearchResult extends Restaurant {
  cityName?: string;
  matchedDishes?: string[];
  dishTranslations?: Record<string, string>;
  matchScore: number;
  bayesianRating: number;
  isSponsored?: boolean;
  hasDishMatch?: boolean;
  chainName?: string;
  chainLocationsCount?: number;
}

interface SearchFilters {
  priceLevel?: number[];
  ambienceTags?: string[];
  cuisines?: string[];
  concepts?: string[];
  mealTypes?: string[];
  experiences?: string[];
  dietaryOptions?: string[];
  hasTerrace?: boolean;
  radiusKm?: number;
}

// Max restaurants to fetch for browse-mode (no dish query)
const BROWSE_LIMIT = 1000;

/**
 * Paginated fetch helper — defeats Supabase's 1000-row default cap.
 * Fetches all rows matching a query by paginating with .range().
 */
async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => any,
  pageSize = 1000
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await buildQuery(offset, offset + pageSize - 1);
    if (error || !data) break;
    allRows.push(...(data as T[]));
    hasMore = data.length === pageSize;
    offset += pageSize;
  }

  return allRows;
}

// Module-level cache so returning to /search (browser back) restores results instantly.
type SearchSnapshot = {
  results: SearchResult[];
  detectedCity: { id: string; name: string } | null;
  didYouMean: string | null;
  isFuzzyMatch: boolean;
  parsedQuery: string;
  at: number;
};
const SEARCH_CACHE_TTL = 10 * 60 * 1000;
const searchResultCache = new Map<string, SearchSnapshot>();
let lastSnapshot: SearchSnapshot | null = null;

export function useSearch() {
  const [loading, setLoading] = useState(false);
  const [results, setResultsState] = useState<SearchResult[]>(() => lastSnapshot?.results ?? []);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [detectedCity, setDetectedCityState] = useState<{ id: string; name: string } | null>(() => lastSnapshot?.detectedCity ?? null);
  const [didYouMean, setDidYouMeanState] = useState<string | null>(() => lastSnapshot?.didYouMean ?? null);
  const [isFuzzyMatch, setIsFuzzyMatchState] = useState(() => lastSnapshot?.isFuzzyMatch ?? false);
  const [parsedQuery, setParsedQueryState] = useState(() => lastSnapshot?.parsedQuery ?? '');
  const parseCacheRef = useRef(new Map<string, ParsedTerm>());
  const lastSearchRef = useRef<{ key: string; running: boolean; doneAt: number } | null>(null);

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    const { data } = await supabase.from('cities').select('*').eq('is_active', true).order('name');
    if (data) setCities(data);
  };

  const search = useCallback(async (query: string, cityIdInput?: string, filters?: SearchFilters, featuredOnly?: boolean) => {
    const rawKey = JSON.stringify([query.toLowerCase().trim(), cityIdInput || 'all', filters ?? null, !!featuredOnly]);
    const cached = searchResultCache.get(rawKey);
    if (cached && Date.now() - cached.at < SEARCH_CACHE_TTL) {
      lastSnapshot = cached;
      setResultsState(cached.results);
      setDetectedCityState(cached.detectedCity);
      setDidYouMeanState(cached.didYouMean);
      setIsFuzzyMatchState(cached.isFuzzyMatch);
      setParsedQueryState(cached.parsedQuery);
      setLoading(false);
      return;
    }
    const snap: Omit<SearchSnapshot, 'results' | 'at'> = { detectedCity: null, didYouMean: null, isFuzzyMatch: false, parsedQuery: '' };
    const setDetectedCity = (v: { id: string; name: string } | null) => { snap.detectedCity = v; setDetectedCityState(v); };
    const setDidYouMean = (v: string | null) => { snap.didYouMean = v; setDidYouMeanState(v); };
    const setIsFuzzyMatch = (v: boolean) => { snap.isFuzzyMatch = v; setIsFuzzyMatchState(v); };
    const setParsedQuery = (v: string) => { snap.parsedQuery = v; setParsedQueryState(v); };
    const setResults = (r: SearchResult[]) => {
      const entry = { ...snap, results: r, at: Date.now() };
      searchResultCache.set(rawKey, entry);
      lastSnapshot = entry;
      setResultsState(r);
    };
    setLoading(true);
    let cityId = cityIdInput;
    const noCityChosen = !cityId || cityId === 'all';

    const queryLower = query.toLowerCase().trim();
    const now = new Date();

    // Support multi-dish search: split by comma, then parse each term (city detection)
    const rawTerms = queryLower.split(',').map(t => t.trim()).filter(t => t.length > 0);
    const parsed = await Promise.all(
      rawTerms.map(async (term) => {
        const cached = parseCacheRef.current.get(term);
        if (cached) return cached;
        const { data, error } = await supabase.rpc('parse_search_query' as any, { p_query: term });
        if (error) console.error('parse_search_query error:', error);
        const row = ((Array.isArray(data) ? data[0] : data) as ParsedTerm | undefined) ?? { term, city_id: null, city_name: null };
        parseCacheRef.current.set(term, row);
        // The stripped term contains no city anymore → cache it so a URL rewrite doesn't re-parse.
        const stripped = (row.term ?? '').toLowerCase().trim();
        if (stripped && !parseCacheRef.current.has(stripped)) {
          parseCacheRef.current.set(stripped, { term: stripped, city_id: null, city_name: null });
        }
        return row;
      })
    );
    let detected: { id: string; name: string } | null = null;
    if (noCityChosen) {
      const hit = parsed.find(p => p.city_id);
      if (hit?.city_id) {
        detected = { id: hit.city_id, name: hit.city_name || '' };
        cityId = hit.city_id;
      }
    }
    setDetectedCity(detected);

    const queryTerms = parsed
      .map(p => (p.term ?? '').toLowerCase().trim())
      .filter(t => t.length > 0);
    const isMultiDish = queryTerms.length > 1;
    setParsedQuery(queryTerms.join(', '));

    const ctx: ScoringContext = { queryLower: queryTerms[0] || '', now };

    // Dedup: skip if the same (terms, city, filters) is running or just finished.
    const searchKey = JSON.stringify([queryTerms, cityId && cityId !== 'all' ? cityId : null, filters ?? null, !!featuredOnly]);
    const last = lastSearchRef.current;
    if (last && last.key === searchKey && (last.running || Date.now() - last.doneAt < 5000)) {
      if (!last.running) setLoading(false);
      return;
    }
    const thisRun = { key: searchKey, running: true, doneAt: 0 };
    lastSearchRef.current = thisRun;
    const finish = () => { thisRun.running = false; thisRun.doneAt = Date.now(); };
    // Start loading the listable-filter in parallel with search_restaurants.
    const emptyIdsPromise = getEmptyRestaurantIds();

    let citiesToUse = cities;
    if (citiesToUse.length === 0) {
      const { data } = await supabase.from('cities').select('*').eq('is_active', true).order('name');
      citiesToUse = data || [];
      if (citiesToUse.length > 0) setCities(citiesToUse);
    }

    // ── Step 1: search_restaurants RPC per term ──
    const restaurantDishMap = new Map<string, DishMatchInfo[]>();
    const dishLinkedRestaurantIds = new Set<string>();
    const termRestaurantIds = new Map<string, Set<string>>();
    const restaurantDishCount = new Map<string, number>();
    let firstDidYouMean: string | null = null;
    let fuzzy = false;

    if (queryTerms.length > 0) {
      const termResults = await Promise.all(
        queryTerms.map(async (term) => {
          const { data, error } = await supabase.rpc('search_restaurants' as any, {
            p_term: term,
            p_city_id: cityId && cityId !== 'all' ? cityId : null,
            p_limit: 1000,
          });
          if (error) console.error('search_restaurants error:', error);
          return ((data as any[]) || []) as Array<{
            restaurant_id: string;
            match_score: number;
            match_type: string | null;
            matched_dishes: string[] | null;
            approved_dish_count: number | null;
            resolved_term: string | null;
            did_you_mean: string | null;
          }>;
        })
      );

      queryTerms.forEach((term, i) => {
        const rows = termResults[i];
        if (!firstDidYouMean && rows[0]?.did_you_mean) firstDidYouMean = rows[0].did_you_mean;
        if (rows.some(r => r.match_type === 'lijkt op')) fuzzy = true;
        const ids = new Set<string>();
        rows.forEach(r => {
          ids.add(r.restaurant_id);
          dishLinkedRestaurantIds.add(r.restaurant_id);
          restaurantDishCount.set(r.restaurant_id, Number(r.approved_dish_count) || 0);
          const existing = restaurantDishMap.get(r.restaurant_id) || [];
          (r.matched_dishes || []).forEach(name => {
            existing.push({ name, isSignature: false, confidenceScore: Number(r.match_score) || 0 });
          });
          restaurantDishMap.set(r.restaurant_id, existing);
        });
        termRestaurantIds.set(term, ids);
      });
    }
    setDidYouMean(firstDidYouMean);
    setIsFuzzyMatch(fuzzy);

    // Dutch display translations for matched dish names (dishes.vertaling_nl).
    // Display-only: never affects ranking, titles or URLs.
    let dishTranslations: Record<string, string> | undefined;
    if (queryTerms.length > 0) {
      const matchedNames = new Set<string>();
      restaurantDishMap.forEach(infos => infos.forEach(d => matchedNames.add(d.name)));
      if (matchedNames.size > 0) {
        const { data: translationRows } = await supabase
          .from('dishes')
          .select('name, vertaling_nl')
          .in('name', [...matchedNames])
          .not('vertaling_nl', 'is', null);
        if (translationRows && translationRows.length > 0) {
          dishTranslations = {};
          for (const row of translationRows as Array<{ name: string; vertaling_nl: string | null }>) {
            if (row.vertaling_nl) dishTranslations[row.name] = row.vertaling_nl;
          }
          restaurantDishMap.forEach(infos => infos.forEach(d => { d.translation = dishTranslations![d.name]; }));
        }
      }
    }

    // A search term without matches → 0 results. Never fall back to all restaurants.
    if (queryTerms.length > 0 && dishLinkedRestaurantIds.size === 0) {
      setResults([]);
      finish(); setLoading(false);
      return;
    }

    // ── Step 2b: Dietary filter — get restaurant IDs via restaurant_dishes ──
    let dietaryRestaurantIds: Set<string> | null = null;
    if (filters?.dietaryOptions && filters.dietaryOptions.length > 0) {
      // Boolean columns on restaurant_dishes (legacy source of truth).
      // 'vegetarian' and 'lactose-free' don't have a boolean column and
      // rely purely on the dietary_tags array below.
      const dietaryMap: Record<string, string> = {
        'vegan': 'is_vegan',
        'vegetarian': 'is_vegetarian',
        'gluten-free': 'is_gluten_free',
        'halal': 'is_halal',
      };

      // Also map to restaurant-level columns
      const restaurantLevelMap: Record<string, string> = {
        'vegan': 'is_fully_vegan',
        'halal': 'is_fully_halal',
      };

      // Build OR filter conditions for each dietary option on restaurant_dishes
      const orConditions = filters.dietaryOptions
        .map(opt => dietaryMap[opt])
        .filter(Boolean)
        .map(col => `${col}.eq.true`);

      // Get IDs from dish-level dietary flags (boolean columns)
      const dishLevelIds = new Set<string>();
      if (orConditions.length > 0) {
        const { data: dietaryLinks } = await supabase
          .from('restaurant_dishes')
          .select('restaurant_id')
          .neq('status', 'rejected')
          .or(orConditions.join(','));
        (dietaryLinks || []).forEach((l: any) => dishLevelIds.add(l.restaurant_id));
      }

      // Also match via the dietary_tags text[] array — this is what
      // owners populate for tags without a dedicated boolean column
      // ('vegetarian', 'lactose-free') and is used for any option they
      // explicitly tag on a dish.
      {
        const { data: taggedLinks } = await supabase
          .from('restaurant_dishes')
          .select('restaurant_id')
          .neq('status', 'rejected')
          .overlaps('dietary_tags', filters.dietaryOptions);
        (taggedLinks || []).forEach((l: any) => dishLevelIds.add(l.restaurant_id));
      }

      // Also get IDs from restaurant-level flags (is_fully_halal, is_fully_vegan, etc.)
      const restaurantOrConds = filters.dietaryOptions
        .map(opt => restaurantLevelMap[opt])
        .filter(Boolean)
        .map(col => `${col}.eq.true`);

      if (restaurantOrConds.length > 0) {
        const { data: restaurantLevel } = await supabase
          .from('restaurants')
          .select('id')
          .eq('is_active', true)
          .or(restaurantOrConds.join(','));
        (restaurantLevel || []).forEach((r: any) => dishLevelIds.add(r.id));
      }

      dietaryRestaurantIds = dishLevelIds;
    }

    // ── Step 3: Fetch restaurants ──
    const hasDishMatches = dishLinkedRestaurantIds.size > 0;

    // Dish-first listing eligibility: exclude active restaurants that have 0
    // approved dishes from search results and browse. Reversible: as soon as
    // a restaurant gets ≥1 approved_by_admin dish it shows up again.
    const emptyRestaurantIds = await emptyIdsPromise;

    // Distance-based expansion: when a city is selected AND user requested a radius,
    // we drop the strict city_id filter and post-filter by Haversine distance from the
    // city centroid (avg geo of all restaurants in that city).
    const wantsRadius = !!(filters?.radiusKm && filters.radiusKm > 0 && cityId && cityId !== 'all');
    let cityCenter: { lat: number; lng: number } | null = null;
    if (wantsRadius) {
      const { data: centerRows } = await supabase
        .from('restaurants')
        .select('geo_lat, geo_lng')
        .eq('city_id', cityId!)
        .eq('is_active', true)
        .not('geo_lat', 'is', null)
        .not('geo_lng', 'is', null)
        .limit(200);
      if (centerRows && centerRows.length > 0) {
        const lats = centerRows.map((r: any) => Number(r.geo_lat));
        const lngs = centerRows.map((r: any) => Number(r.geo_lng));
        cityCenter = {
          lat: lats.reduce((a, b) => a + b, 0) / lats.length,
          lng: lngs.reduce((a, b) => a + b, 0) / lngs.length,
        };
      }
    }

    const buildRestaurantQuery = (idChunk?: string[]) => {
      let q = supabase.from('restaurants').select('*').eq('is_active', true);
      // Hide restaurants without photos from public listings
      q = q.not('images', 'is', null).not('images', 'eq', '{}');

      if (idChunk) {
        q = q.in('id', idChunk);
      } else {
        q = q.limit(BROWSE_LIMIT);
      }

      if (featuredOnly) {
        q = q.or('is_featured.eq.true,is_top_listing.eq.true');
      }
      // Skip strict city_id when a radius is requested (we filter by distance below)
      if (cityId && cityId !== 'all' && !(wantsRadius && cityCenter)) {
        q = q.eq('city_id', cityId);
      }

      // Apply filters
      if (filters?.priceLevel && filters.priceLevel.length > 0) {
        q = q.in('price_level', filters.priceLevel);
      }
      if (filters?.ambienceTags && filters.ambienceTags.length > 0) {
        // 7 gegroepeerde sfeer-chips → set ruwe DB-waarden.
        const ambienceAliases: Record<string, string[]> = {
          'romantisch':      ['Romantisch', 'Intiem'],
          'gezellig':        ['Gezellig', 'Warm', 'Traditioneel', 'Klassiek'],
          'trendy':          ['Trendy', 'Modern', 'Industrieel', 'Minimalistisch', 'Bohemian', 'Levendig', 'Bruisend'],
          'casual':          ['Casual'],
          'luxe':            ['Luxe', 'Fine Dining', 'High-end'],
          'zakelijk':        ['Zakelijk'],
          'kindvriendelijk': ['Kindvriendelijk', 'Gezinsvriendelijk'],
        };
        const expandedTags = filters.ambienceTags.flatMap(tag => {
          const aliases = ambienceAliases[tag.toLowerCase()];
          return aliases || [tag, tag.toLowerCase(), tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase()];
        });
        q = q.overlaps('ambience_tags', [...new Set(expandedTags)]);
      }
      if (filters?.cuisines && filters.cuisines.length > 0) {
        // Map English filter values to all known DB variants (case-insensitive)
        const cuisineAliases: Record<string, string[]> = {
          'japanese': ['japanese', 'japans', 'Japans'],
          'italian': ['italian', 'italiaans', 'Italiaans'],
          'french': ['french', 'frans', 'Frans'],
          'chinese': ['chinese', 'chinees', 'Chinees'],
          'indian': ['indian', 'indiaas', 'Indiaas'],
          'mexican': ['mexican', 'mexicaans', 'Mexicaans'],
          'thai': ['thai', 'thais', 'Thais'],
          'greek': ['greek', 'grieks', 'Grieks'],
          'spanish': ['spanish', 'spaans', 'Spaans'],
          'korean': ['korean', 'koreaans', 'Koreaans'],
          'vietnamese': ['vietnamese', 'vietnamees', 'Vietnamees'],
          'american': ['american', 'amerikaans', 'Amerikaans', 'americaans'],
          'vegetarian': ['vegetarian', 'vegetarisch', 'Vegetarisch'],
          'vegan': ['vegan', 'veganistisch', 'Veganistisch'],
          'seafood': ['seafood', 'vis', 'Vis', 'zeevruchten'],
          'steakhouse': ['steakhouse', 'Steakhouse'],
          'sushi': ['sushi', 'Sushi'],
          'mediterranean': ['mediterranean', 'mediterraans', 'Mediterraans'],
          'indonesian': ['indonesian', 'indonesisch', 'Indonesisch'],
          'surinamese': ['surinamese', 'surinaams', 'Surinaams'],
          'asian': ['asian', 'aziatisch', 'Aziatisch'],
          'fusion': ['fusion', 'Fusion'],
          'dutch': ['dutch', 'nederlands', 'Nederlands', 'hollands'],
          'international': ['international', 'internationaal', 'Internationaal'],
          'kantonees': ['kantonees', 'Kantonees', 'cantonese'],
        };
        const expandedCuisines = filters.cuisines.flatMap(c => {
          const aliases = cuisineAliases[c.toLowerCase()];
          return aliases || [c, c.toLowerCase(), c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()];
        });
        const uniqueCuisines = [...new Set(expandedCuisines)];
        // Prefer the cleaned `cuisine_primary` column, but keep legacy `cuisines` array as fallback
        const primaryList = uniqueCuisines.map((c) => `"${c.replace(/"/g, '\\"')}"`).join(',');
        const overlapsList = `{${uniqueCuisines.map((c) => `"${c.replace(/"/g, '\\"')}"`).join(',')}}`;
        q = q.or(`cuisine_primary.in.(${primaryList}),cuisines.ov.${overlapsList}`);
      }
      if (filters?.concepts && filters.concepts.length > 0) {
        q = q.overlaps('concepts', filters.concepts);
      }
      if (filters?.mealTypes && filters.mealTypes.length > 0) {
        q = q.overlaps('meal_types', filters.mealTypes);
      }
      if (filters?.experiences && filters.experiences.length > 0) {
        q = q.overlaps('experiences', filters.experiences);
      }
      // Dietary is already handled via restaurant_dishes pre-filter above
      if (filters?.hasTerrace) {
        // Terras info lives both on the boolean column AND in the concepts
        // array ('Terras restaurant'). Match either so the filter reflects
        // the real terrace inventory.
        q = q.or('has_terrace.eq.true,concepts.cs.{"Terras restaurant"}');
      }

      return q;
    };

    // Dish matches: fetch by id in parallel blocks of 150. Otherwise paginate.
    let restaurants: Restaurant[];
    if (hasDishMatches || dietaryRestaurantIds) {
      let targetIds = hasDishMatches ? [...dishLinkedRestaurantIds] : [...dietaryRestaurantIds!];
      if (hasDishMatches && dietaryRestaurantIds) {
        targetIds = targetIds.filter(id => dietaryRestaurantIds!.has(id));
      }
      const chunks: string[][] = [];
      for (let i = 0; i < targetIds.length; i += 150) chunks.push(targetIds.slice(i, i + 150));
      const parts = await Promise.all(
        chunks.map(async (chunk) => {
          const { data } = await buildRestaurantQuery(chunk);
          return (data as Restaurant[]) || [];
        })
      );
      restaurants = parts.flat();
    } else {
      restaurants = await fetchAllRows<Restaurant>((from, to) =>
        buildRestaurantQuery().range(from, to)
      );
    }

    if (!restaurants) {
      setResults([]);
      finish(); setLoading(false);
      return;
    }

    // Exclude restaurants without approved dishes (dish-first platform).
    let filteredRestaurants = restaurants.filter((r) => !emptyRestaurantIds.has(r.id));

    // Apply radius post-filter (Haversine) when expansion is active.
    if (wantsRadius && cityCenter) {
      const maxKm = filters!.radiusKm!;
      filteredRestaurants = filteredRestaurants.filter((r) => {
        if (r.geo_lat == null || r.geo_lng == null) return false;
        const d = calculateDistance(cityCenter!.lat, cityCenter!.lng, Number(r.geo_lat), Number(r.geo_lng));
        return d <= maxKm;
      });
    }

    // ── Step 4: Chain info (batch) ──
    const chainIds = [...new Set(filteredRestaurants.map(r => r.chain_id).filter(Boolean))] as string[];
    const chainNameById = new Map<string, string>();
    const chainCountById = new Map<string, number>();

    if (chainIds.length > 0) {
      const [chainsRes, chainRestaurantsRes] = await Promise.all([
        supabase.from('restaurant_chains').select('id,name').in('id', chainIds),
        supabase.from('restaurants').select('id,chain_id').eq('is_active', true).in('chain_id', chainIds),
      ]);
      (chainsRes.data || []).forEach((c: any) => chainNameById.set(c.id, c.name));
      (chainRestaurantsRes.data || []).forEach((r: any) => {
        if (r.chain_id) chainCountById.set(r.chain_id, (chainCountById.get(r.chain_id) || 0) + 1);
      });
    }

    const cityMap = new Map(citiesToUse.map(c => [c.id, c.name]));

    // ── Step 5: No query → browse mode ──
    if (queryTerms.length === 0) {
      const scoredResults: SearchResult[] = filteredRestaurants.map(r => ({
        ...r,
        cityName: cityMap.get(r.city_id),
        chainName: r.chain_id ? chainNameById.get(r.chain_id) : undefined,
        chainLocationsCount: r.chain_id ? chainCountById.get(r.chain_id) : undefined,
        matchScore: r.is_featured ? 2 : r.is_top_listing ? 1 : 0,
        bayesianRating: bayesianRating(Number(r.rating), r.review_count),
      }));
      
      const sorted = sortResults(scoredResults);
      setResults(sorted);
      finish(); setLoading(false);
      return;
    }

    // ── Step 6: Sponsored check ──
    const sponsoredRestaurants = new Set<string>();
    if (hasDishMatches && cityId && cityId !== 'all') {
      const names = [...new Set([...restaurantDishMap.values()].flat().map(d => d.name))].slice(0, 300);
      const { data: dishRows } = names.length
        ? await supabase.from('dishes').select('id').in('name', names)
        : { data: [] as any[] };
      const dishIds = (dishRows || []).map((d: any) => d.id);
      const { data: sponsoredData } = dishIds.length ? await supabase
        .from('sponsored_purchases_public' as any)
        .select('restaurant_id, sponsored_products!inner(dish_id, city_id)')
        .eq('is_active', true)
        .gt('expires_at', now.toISOString()) : { data: null };

      if (sponsoredData) {
        (sponsoredData as any[]).forEach((sp: any) => {
          const product = sp.sponsored_products;
          if (dishIds.includes(product.dish_id) && product.city_id === cityId) {
            sponsoredRestaurants.add(sp.restaurant_id);
          }
        });
      }
    }

    // ── Step 7: Multi-dish coverage ──
    const restaurantTermCoverage = new Map<string, number>();
    if (isMultiDish) {
      for (const ids of termRestaurantIds.values()) {
        ids.forEach(id => restaurantTermCoverage.set(id, (restaurantTermCoverage.get(id) || 0) + 1));
      }
    }

    // ── Step 8: Score & rank ──
    const scoredResults: SearchResult[] = [];
    const totalQueryTerms = isMultiDish ? queryTerms.length : 1;

    for (const restaurant of filteredRestaurants) {
      const linkedDishes = restaurantDishMap.get(restaurant.id) || null;
      
      if (hasDishMatches && (!linkedDishes || linkedDishes.length === 0)) {
        continue;
      }

      const scored = scoreRestaurant(
        {
          id: restaurant.id,
          name: restaurant.name,
          rating: Number(restaurant.rating),
          review_count: restaurant.review_count,
          cuisines: restaurant.cuisines,
          is_featured: restaurant.is_featured,
          is_top_listing: restaurant.is_top_listing,
          chain_id: restaurant.chain_id,
          created_at: restaurant.created_at,
          linkedDishes,
          isSponsored: sponsoredRestaurants.has(restaurant.id),
          queryTermsCovered: restaurantTermCoverage.get(restaurant.id) || 0,
          totalQueryTerms,
          totalDishCount: restaurantDishCount.get(restaurant.id) || 0,
        },
        ctx
      );

      if (scored.matchScore > 0) {
        scoredResults.push({
          ...restaurant,
          cityName: cityMap.get(restaurant.city_id),
          chainName: restaurant.chain_id ? chainNameById.get(restaurant.chain_id) : undefined,
          chainLocationsCount: restaurant.chain_id ? chainCountById.get(restaurant.chain_id) : undefined,
          matchedDishes: scored.matchedDishes,
          dishTranslations,
          matchScore: scored.matchScore,
          bayesianRating: scored.bayesianRating,
          isSponsored: scored.isSponsored,
          hasDishMatch: scored.hasDishMatch,
        });
      }
    }

    let sorted = sortResults(scoredResults);
    // Multi-dish: restaurants serving more of the searched dishes always rank first.
    if (isMultiDish) {
      sorted = sorted
        .map((r, i) => ({ r, i, c: restaurantTermCoverage.get(r.id) || 0 }))
        .sort((a, b) => b.c - a.c || a.i - b.i)
        .map(x => x.r);
    }
    const rebalanced = rebalanceSponsoredResults(sorted);

    setResults(rebalanced);
    finish(); setLoading(false);
  }, [cities]);

  return { search, results, loading, dishes, cities, detectedCity, didYouMean, isFuzzyMatch, parsedQuery };
}
