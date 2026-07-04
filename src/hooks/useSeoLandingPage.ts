import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface FAQ {
  question: string;
  answer: string;
}

export interface SeoLandingPage {
  id: string;
  slug: string;
  dish_id: string | null;
  city_id: string | null;
  meta_title: string;
  meta_description: string;
  h1_title: string;
  intro_text: string | null;
  extended_description: string | null;
  faq_content: FAQ[];
  keywords: string[] | null;
  canonical_url: string | null;
  is_active: boolean;
  is_auto_generated: boolean;
  created_at: string;
  updated_at: string;
  dish?: {
    id: string;
    name: string;
    slug: string;
    canonical_slug?: string | null;
  };
  city?: {
    id: string;
    name: string;
    slug: string;
  };
}

async function resolveCanonicalRedirect(slug: string): Promise<string | null> {
  // Find the longest matching city slug at the end of the URL slug
  const parts = slug.split('-');
  for (let i = 1; i < parts.length; i++) {
    const citySlugCandidate = parts.slice(i).join('-');
    const dishSlugCandidate = parts.slice(0, i).join('-');
    if (!citySlugCandidate || !dishSlugCandidate) continue;

    const { data: city } = await supabase
      .from('cities')
      .select('id, slug')
      .eq('slug', citySlugCandidate)
      .maybeSingle();
    if (!city) continue;

    // Look up the dish by slug and check its canonical_slug
    const { data: dish } = await supabase
      .from('dishes')
      .select('slug, canonical_slug')
      .eq('slug', dishSlugCandidate)
      .maybeSingle();
    if (!dish) continue;

    const canonical = dish.canonical_slug && dish.canonical_slug.length > 0
      ? dish.canonical_slug
      : dish.slug;
    if (canonical === dish.slug) return null;

    // Find canonical dish IDs, then check if an SEO page exists for that city
    const { data: canonDishes } = await supabase
      .from('dishes')
      .select('id')
      .eq('slug', canonical);
    const ids = (canonDishes || []).map((d: { id: string }) => d.id);
    if (ids.length === 0) return null;

    const { data: canonicalPage } = await supabase
      .from('seo_landing_pages')
      .select('slug')
      .eq('city_id', city.id)
      .eq('is_active', true)
      .in('dish_id', ids)
      .maybeSingle();
    if (canonicalPage?.slug) return `/eten/${canonicalPage.slug}`;
    return null;
  }
  return null;
}

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string;
  rating: number;
  review_count: number;
  price_level: number;
  images: string[] | null;
  cuisines: string[] | null;
  ambience_tags: string[] | null;
  is_featured: boolean;
  is_top_listing: boolean;
  geo_lat: number | null;
  geo_lng: number | null;
  signatureDish?: { name: string; price: number | null } | null;
}

export function useSeoLandingPage(slug: string | undefined) {
  const [page, setPage] = useState<SeoLandingPage | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);
  const [canonicalDishName, setCanonicalDishName] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    async function fetchPage() {
      setLoading(true);
      setError(null);

      try {
        // Fetch the SEO page
        const { data: pageData, error: pageError } = await supabase
          .from('seo_landing_pages')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .single();

        if (pageError) {
          if (pageError.code === 'PGRST116') {
            // Try canonical redirect before giving up: parse slug into {dish}-{city}
            const canonicalRedirect = await resolveCanonicalRedirect(slug);
            if (canonicalRedirect) {
              setRedirectTo(canonicalRedirect);
              setLoading(false);
              return;
            }
            setError('Page not found');
          } else {
            throw pageError;
          }
          setLoading(false);
          return;
        }

        // Fetch dish and city details
        let dish = null;
        let city = null;

        if (pageData.dish_id) {
          const { data: dishData } = await supabase
            .from('dishes')
            .select('id, name, slug, canonical_slug')
            .eq('id', pageData.dish_id)
            .single();
          dish = dishData;
        }

        if (pageData.city_id) {
          const { data: cityData } = await supabase
            .from('cities')
            .select('id, name, slug')
            .eq('id', pageData.city_id)
            .single();
          city = cityData;
        }

        // Parse FAQ content safely
        const faqContent = Array.isArray(pageData.faq_content) 
          ? (pageData.faq_content as unknown as FAQ[])
          : [];

        setPage({
          ...pageData,
          faq_content: faqContent,
          dish: dish || undefined,
          city: city || undefined,
        });

        // Determine canonical slug for grouping (fall back to the dish's own slug)
        const canonicalSlug = (dish?.canonical_slug && dish.canonical_slug.length > 0)
          ? dish.canonical_slug
          : dish?.slug || null;

        // 301-redirect: if the URL dish is a non-canonical variant, redirect to canonical
        if (dish && city && dish.canonical_slug && dish.canonical_slug !== dish.slug) {
          const { data: canonicalPage } = await supabase
            .from('seo_landing_pages')
            .select('slug')
            .eq('city_id', city.id)
            .eq('is_active', true)
            .in('dish_id', (
              await supabase
                .from('dishes')
                .select('id')
                .eq('slug', dish.canonical_slug)
            ).data?.map((d: { id: string }) => d.id) || [])
            .maybeSingle();
          if (canonicalPage?.slug && canonicalPage.slug !== slug) {
            setRedirectTo(`/eten/${canonicalPage.slug}`);
            setLoading(false);
            return;
          }
        }

        // Look up the human-readable name for the canonical dish (fallback to page dish name)
        if (canonicalSlug) {
          const { data: canonDish } = await supabase
            .from('dishes')
            .select('name')
            .eq('slug', canonicalSlug)
            .maybeSingle();
          setCanonicalDishName(canonDish?.name || dish?.name || null);
        }

        // Fetch all restaurants in city with at least one approved dish sharing this canonical_slug
        if (canonicalSlug && pageData.city_id) {
          // Collect all dish IDs sharing this canonical_slug (paginated to bypass 1000-row limit)
          const dishIds: string[] = [];
          let from = 0;
          const pageSize = 1000;
          while (true) {
            const { data: dishBatch } = await supabase
              .from('dishes')
              .select('id')
              .eq('canonical_slug', canonicalSlug)
              .range(from, from + pageSize - 1);
            if (!dishBatch || dishBatch.length === 0) break;
            dishIds.push(...dishBatch.map(d => d.id));
            if (dishBatch.length < pageSize) break;
            from += pageSize;
          }

          let restaurantIds: string[] = [];
          // restaurantId -> best matched dish (prefer signature, then lowest price, then any)
          const matchByRestaurant = new Map<string, { name: string; price: number | null; is_signature: boolean }>();
          // Map dish_id -> dish name (for the current canonical set)
          const dishNameById = new Map<string, string>();
          if (dishIds.length > 0) {
            // Fetch names for canonical dishes (chunked)
            const nameChunk = 200;
            for (let i = 0; i < dishIds.length; i += nameChunk) {
              const chunk = dishIds.slice(i, i + nameChunk);
              const { data: nameBatch } = await supabase
                .from('dishes')
                .select('id, name')
                .in('id', chunk);
              if (nameBatch) for (const d of nameBatch) dishNameById.set(d.id, (d as any).name);
            }
            // Chunk .in() to keep URL length safe
            const chunkSize = 200;
            for (let i = 0; i < dishIds.length; i += chunkSize) {
              const chunk = dishIds.slice(i, i + chunkSize);
              const { data: rdBatch } = await supabase
                .from('restaurant_dishes')
                .select('restaurant_id, dish_id, price, is_signature')
                .eq('status', 'approved_by_admin')
                .in('dish_id', chunk);
              if (rdBatch) {
                for (const rd of rdBatch as any[]) {
                  restaurantIds.push(rd.restaurant_id);
                  const name = dishNameById.get(rd.dish_id);
                  if (!name) continue;
                  const priceRaw = rd.price;
                  const price = priceRaw !== null && priceRaw !== undefined && !isNaN(Number(priceRaw))
                    ? Number(priceRaw) : null;
                  const candidate = { name, price, is_signature: !!rd.is_signature };
                  const existing = matchByRestaurant.get(rd.restaurant_id);
                  if (!existing) {
                    matchByRestaurant.set(rd.restaurant_id, candidate);
                  } else if (!existing.is_signature && candidate.is_signature) {
                    matchByRestaurant.set(rd.restaurant_id, candidate);
                  } else if (existing.price === null && candidate.price !== null && existing.is_signature === candidate.is_signature) {
                    matchByRestaurant.set(rd.restaurant_id, candidate);
                  }
                }
              }
            }
            restaurantIds = Array.from(new Set(restaurantIds));
          }

          if (restaurantIds.length > 0) {
            const results: Restaurant[] = [];
            const chunkSize = 200;
            for (let i = 0; i < restaurantIds.length; i += chunkSize) {
              const chunk = restaurantIds.slice(i, i + chunkSize);
              const { data: rBatch } = await supabase
                .from('restaurants')
                .select('*')
                .in('id', chunk)
                .eq('city_id', pageData.city_id)
                .eq('is_active', true);
              if (rBatch) results.push(...(rBatch as Restaurant[]));
            }
            // Attach signatureDish per restaurant from the canonical-strict match map
            for (const r of results) {
              const m = matchByRestaurant.get(r.id);
              if (m) (r as any).signatureDish = { name: m.name, price: m.price };
            }
            results.sort((a, b) => {
              if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
              if (a.is_top_listing !== b.is_top_listing) return a.is_top_listing ? -1 : 1;
              return (b.rating || 0) - (a.rating || 0);
            });
            // Strict: only restaurants that actually have a canonical-matched approved dish
            setRestaurants(results.filter(r => (r as any).signatureDish));
          } else {
            const { data: cityRestaurants } = await supabase
              .from('restaurants')
              .select('*')
              .eq('city_id', pageData.city_id)
              .eq('is_active', true)
              .order('is_featured', { ascending: false })
              .order('rating', { ascending: false })
              .limit(12);
            setRestaurants(cityRestaurants || []);
          }
        }
      } catch (err) {
        console.error('Error fetching SEO page:', err);
        setError('Failed to load page');
      } finally {
        setLoading(false);
      }
    }

    fetchPage();
  }, [slug]);

  return { page, restaurants, loading, error, redirectTo, canonicalDishName };
}

export function useSeoLandingPages() {
  const [pages, setPages] = useState<SeoLandingPage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPages = async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('seo_landing_pages')
      .select(`
        *,
        dishes:dish_id (id, name, slug),
        cities:city_id (id, name, slug)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPages(data.map(p => ({
        ...p,
        faq_content: Array.isArray(p.faq_content) ? (p.faq_content as unknown as FAQ[]) : [],
        dish: p.dishes,
        city: p.cities,
      })));
    }
    
    setLoading(false);
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const updatePage = async (id: string, updates: Partial<SeoLandingPage>) => {
    const { faq_content, ...rest } = updates;
    const { error } = await supabase
      .from('seo_landing_pages')
      .update({
        ...rest,
        ...(faq_content !== undefined && { faq_content: faq_content as unknown as Json }),
        is_auto_generated: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (!error) {
      await fetchPages();
    }
    return { error };
  };

  const createPage = async (page: Omit<SeoLandingPage, 'id' | 'created_at' | 'updated_at'>) => {
    const { faq_content, ...rest } = page;
    const { error } = await supabase
      .from('seo_landing_pages')
      .insert([{
        ...rest,
        faq_content: faq_content as unknown as Json,
      }]);

    if (!error) {
      await fetchPages();
    }
    return { error };
  };

  const deletePage = async (id: string) => {
    const { error } = await supabase
      .from('seo_landing_pages')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchPages();
    }
    return { error };
  };

  return { pages, loading, fetchPages, updatePage, createPage, deletePage };
}
