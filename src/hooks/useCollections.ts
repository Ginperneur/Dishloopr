import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Collection {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  title_i18n?: Record<string, string> | null;
  subtitle_i18n?: Record<string, string> | null;
  description_i18n?: Record<string, string> | null;
  cover_image: string | null;
  city_id: string | null;
  dish_id: string | null;
  cuisine: string | null;
  ambience_tag: string | null;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  /** Match rules (20261125100000_dish_collections.sql): set means the list fills itself. */
  match_dishes?: string[] | null;
  match_dish_names?: string[] | null;
  match_dietary?: string | null;
  match_concepts?: string[] | null;
  /** Photo of the number 1, used when there is no cover_image. */
  auto_cover?: string | null;
  city?: { name: string; slug: string } | null;
  dish?: { name: string; slug: string } | null;
}

export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('collections')
      .select(`
        *,
        city:city_id (name, slug),
        dish:dish_id (name, slug),
        collection_restaurants(count)
      `)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching collections:', error);
    } else {
      setCollections((data || []) as unknown as Collection[]);
    }
    setLoading(false);
  };

  return { collections, loading, refetch: fetchCollections };
}

/** One active collection by slug (its restaurants come from useCollectionList). */
export function useCollection(slug: string | undefined) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from('collections')
      .select(`
        *,
        city:city_id (name, slug),
        dish:dish_id (name, slug)
      `)
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('Error fetching collection:', error);
        setCollection((data ?? null) as unknown as Collection | null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  return { collection, loading };
}

// collection_list and collection_cities are not in the generated types yet.
type UntypedRpc = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>;

/** A collection that fills itself from dishes, dietary flags or concepts (not only hand-picked). */
export const isAutoCollection = (c: Pick<Collection, 'match_dishes' | 'match_dish_names' | 'match_dietary' | 'match_concepts'>) =>
  Boolean(c.match_dishes?.length || c.match_dish_names?.length || c.match_dietary || c.match_concepts?.length);

export interface CollectionListItem {
  restaurant_id: string;
  name: string;
  slug: string;
  address: string | null;
  city_name: string | null;
  city_slug: string | null;
  images: string[] | null;
  price_level: number | null;
  cuisines: string[] | null;
  ambience_tags: string[] | null;
  dish_name: string | null;
  dish_price: number | null;
  /** Published Dishloopr reviews of the matching dish (concept collections: of the restaurant). */
  review_count: number;
  review_avg: number | null;
  is_pick: boolean;
  pick_reason: string | null;
  total: number;
}

/** The ranked restaurants of a collection, across the Netherlands or in one city (collection_list). */
export function useCollectionList(slug: string | undefined, citySlug: string | null, limit = citySlug ? 15 : 20) {
  return useQuery({
    queryKey: ['collection-list', slug, citySlug, limit],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as UntypedRpc)('collection_list', { p_slug: slug, p_city_slug: citySlug, p_limit: limit });
      if (error) throw error;
      return ((data ?? []) as CollectionListItem[]).map(r => ({
        ...r,
        dish_price: r.dish_price == null ? null : Number(r.dish_price),
        review_count: Number(r.review_count) || 0,
        review_avg: r.review_avg == null ? null : Number(r.review_avg),
      }));
    },
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });
}

export interface CollectionCity { city_slug: string; city_name: string; restaurants: number }

/** Cities that have restaurants in a collection, most first (collection_cities). */
export function useCollectionCities(slug: string | undefined) {
  return useQuery({
    queryKey: ['collection-cities', slug],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as UntypedRpc)('collection_cities', { p_slug: slug });
      if (error) throw error;
      return (data ?? []) as CollectionCity[];
    },
    enabled: Boolean(slug),
    staleTime: 10 * 60_000,
  });
}

export interface CollectionPaidItem {
  restaurant_id: string;
  name: string;
  slug: string;
  address: string | null;
  city_name: string | null;
  images: string[] | null;
  dish_name: string | null;
  dish_price: number | null;
  review_count: number;
  review_avg: number | null;
}

/** The paid places (max 3) on a collection in one city or nationally (collection_paid_placements). */
export function useCollectionPaidPlacements(slug: string | undefined, citySlug: string | null) {
  return useQuery({
    queryKey: ['collection-paid', slug, citySlug],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as unknown as UntypedRpc)('collection_paid_placements', { p_collection_slug: slug, p_city_slug: citySlug });
      if (error) throw error;
      return ((data ?? []) as CollectionPaidItem[]).map(r => ({
        ...r,
        dish_price: r.dish_price == null ? null : Number(r.dish_price),
        review_count: Number(r.review_count) || 0,
        review_avg: r.review_avg == null ? null : Number(r.review_avg),
      }));
    },
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });
}
