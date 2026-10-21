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
    dish_group?: string | null;
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
  const [isHub, setIsHub] = useState(false);
  const [groupMembers, setGroupMembers] = useState<Array<{ slug: string; name: string; translation: string | null; count: number; seoSlug: string | null }>>([]);
  const [parentHub, setParentHub] = useState<{ slug: string | null; name: string; dishSlug: string } | null>(null);
  const [synthesized, setSynthesized] = useState(false);

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
          .maybeSingle();

        // If no curated SEO row exists, try to synthesize one on-the-fly for any
        // canonical dish that has ≥1 approved dish in the parsed city. This
        // makes /eten/{dish}-{stad} work for every valid canonical, not just
        // curated ones. Non-canonical variants still hit the redirect path.
        let effectivePageData: any = pageData;
        let isSynthesized = false;

        if (!effectivePageData) {
          if (pageError && pageError.code !== 'PGRST116') {
            throw pageError;
          }
            // Try canonical redirect before giving up: parse slug into {dish}-{city}
            const canonicalRedirect = await resolveCanonicalRedirect(slug);
            if (canonicalRedirect) {
              setRedirectTo(canonicalRedirect);
              setLoading(false);
              return;
            }

          // Parse slug into dish + city and synthesize a page if the dish is
          // its own canonical AND has ≥1 approved_by_admin dish in that city.
          const parts = slug.split('-');
          let synth: any = null;
          let synthDish: any = null;
          for (let i = 1; i < parts.length; i++) {
            const citySlugCandidate = parts.slice(i).join('-');
            const dishSlugCandidate = parts.slice(0, i).join('-');
            if (!citySlugCandidate || !dishSlugCandidate) continue;

            const { data: cityRow } = await supabase
              .from('cities')
              .select('id, name, slug')
              .eq('slug', citySlugCandidate)
              .maybeSingle();
            if (!cityRow) continue;

            let { data: dishRow } = await supabase
              .from('dishes')
              .select('id, name, slug, canonical_slug, dish_group')
              .eq('slug', dishSlugCandidate)
              .maybeSingle();
            // If no dish has this exact slug, treat dishSlugCandidate as a
            // canonical_slug (e.g. "ossenhaas", "entrecote") and pick a
            // representative dish row that shares it. This lets every
            // canonical family member get its own /eten/{canonical}-{stad}
            // page even when no dish row literally has that slug.
            let isVirtualCanonical = false;
            if (!dishRow) {
              const { data: rep } = await supabase
                .from('dishes')
                .select('id, name, slug, canonical_slug, dish_group')
                .eq('canonical_slug', dishSlugCandidate)
                .limit(1)
                .maybeSingle();
              if (!rep) continue;
              const humanized = dishSlugCandidate
                .split('-')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');
              dishRow = {
                id: rep.id,
                name: humanized,
                slug: dishSlugCandidate,
                canonical_slug: dishSlugCandidate,
                dish_group: rep.dish_group ?? null,
              } as any;
              isVirtualCanonical = true;
            } else {
              const dCanon = (dishRow.canonical_slug && dishRow.canonical_slug.length > 0)
                ? dishRow.canonical_slug : dishRow.slug;
              // Non-canonical variant with no curated redirect target: skip.
              if (dCanon !== dishRow.slug) continue;
            }

            const dishName = dishRow!.name;
            const cityName = cityRow.name;
            synth = {
              id: `synth-${dishRow.id}-${cityRow.id}`,
              slug,
              dish_id: dishRow.id,
              city_id: cityRow.id,
              meta_title: `Beste ${dishName} in ${cityName} | Dishloopr`,
              meta_description: `Ontdek de beste restaurants voor ${dishName.toLowerCase()} in ${cityName}. Vergelijk, filter en vind jouw favoriet.`,
              h1_title: `Beste ${dishName} in ${cityName}`,
              intro_text: null,
              extended_description: null,
              faq_content: [],
              keywords: null,
              canonical_url: null,
              is_active: true,
              is_auto_generated: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            if (isVirtualCanonical) synthDish = dishRow;
            break;
          }

          if (!synth) {
            setError('Page not found');
            setLoading(false);
            return;
          }
          effectivePageData = synth;
          isSynthesized = true;
          // If we synthesized against a virtual canonical (no dish row with
          // that exact slug), stash the constructed dish for later so we
          // don't over-write slug/canonical_slug via the id-based lookup.
          if (synthDish) (effectivePageData as any).__synthDish = synthDish;
        }

        // Fetch dish and city details
        let dish = null;
        let city = null;

        if ((effectivePageData as any).__synthDish) {
          dish = (effectivePageData as any).__synthDish;
        } else if (effectivePageData.dish_id) {
          const { data: dishData } = await supabase
            .from('dishes')
            .select('id, name, slug, canonical_slug, dish_group')
            .eq('id', effectivePageData.dish_id)
            .single();
          dish = dishData;
        }

        if (effectivePageData.city_id) {
          const { data: cityData } = await supabase
            .from('cities')
            .select('id, name, slug')
            .eq('id', effectivePageData.city_id)
            .single();
          city = cityData;
        }

        // Parse FAQ content safely
        const faqContent = Array.isArray(effectivePageData.faq_content)
          ? (effectivePageData.faq_content as unknown as FAQ[])
          : [];

        setPage({
          ...effectivePageData,
          faq_content: faqContent,
          dish: dish || undefined,
          city: city || undefined,
        });
        setSynthesized(isSynthesized);

        // Determine canonical slug for grouping (fall back to the dish's own slug)
        const canonicalSlug = (dish?.canonical_slug && dish.canonical_slug.length > 0)
          ? dish.canonical_slug
          : dish?.slug || null;

        // Hub detection: dish is the group head when its canonical_slug === dish_group.
        // Hub pages aggregate the whole family (all dishes with dish_group = hub slug).
        const dishGroup = (dish as any)?.dish_group as string | null | undefined;
        const isHubPage = !!(dishGroup && canonicalSlug && dishGroup === canonicalSlug);
        setIsHub(isHubPage);

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

        // Fetch all restaurants in city with at least one qualifying approved dish.
        // - Member pages: dishes sharing this canonical_slug (unchanged).
        // - Hub pages: dishes sharing this dish_group (the whole family).
        if (canonicalSlug && effectivePageData.city_id) {
          // Collect all dish IDs to include (paginated to bypass 1000-row limit)
          const dishRows: Array<{ id: string; name: string; slug: string; canonical_slug: string | null; vertaling_nl: string | null }> = [];
          let from = 0;
          const pageSize = 1000;
          while (true) {
            const q = supabase
              .from('dishes')
              .select('id, name, slug, canonical_slug, vertaling_nl')
              .range(from, from + pageSize - 1);
            const { data: dishBatch } = isHubPage
              ? await q.eq('dish_group', canonicalSlug)
              : await q.eq('canonical_slug', canonicalSlug);
            if (!dishBatch || dishBatch.length === 0) break;
            dishRows.push(...(dishBatch as any));
            if (dishBatch.length < pageSize) break;
            from += pageSize;
          }
          const dishIds = dishRows.map(d => d.id);
          const dishById = new Map(dishRows.map(d => [d.id, d] as const));

          let restaurantIds: string[] = [];
          // restaurantId -> best matched dish (prefer signature, then lowest price, then any)
          const matchByRestaurant = new Map<string, { name: string; price: number | null; is_signature: boolean }>();
          // Map dish_id -> dish name (for the current canonical set)
          const dishNameById = new Map<string, string>();
          // Map restaurant_id -> Set<canonical_slug> matched (used to build hub member counts)
          const restaurantCanonicalMatches = new Map<string, Set<string>>();
          if (dishIds.length > 0) {
            for (const d of dishRows) dishNameById.set(d.id, d.name);
            // Chunk .in() to keep URL length safe
            const chunkSize = 200;
            for (let i = 0; i < dishIds.length; i += chunkSize) {
              const chunk = dishIds.slice(i, i + chunkSize);
              const { data: rdBatch } = await supabase
                .from('restaurant_dishes')
                .select('restaurant_id, dish_id, price, is_signature')
                .in('status', ['approved_by_admin', 'verified_by_owner'])
                .in('dish_id', chunk);
              if (rdBatch) {
                for (const rd of rdBatch as any[]) {
                  restaurantIds.push(rd.restaurant_id);
                  const name = dishNameById.get(rd.dish_id);
                  if (!name) continue;
                  const dRow = dishById.get(rd.dish_id);
                  const memberCanon = (dRow?.canonical_slug && dRow.canonical_slug.length > 0) ? dRow.canonical_slug : dRow?.slug;
                  if (memberCanon) {
                    let s = restaurantCanonicalMatches.get(rd.restaurant_id);
                    if (!s) { s = new Set(); restaurantCanonicalMatches.set(rd.restaurant_id, s); }
                    s.add(memberCanon);
                  }
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
                .eq('city_id', effectivePageData.city_id)
                .eq('is_active', true);
              if (rBatch) results.push(...(rBatch as Restaurant[]));
            }
            // Attach signatureDish per restaurant from the canonical-strict match map
            const vertalingByName = new Map<string, string>();
            for (const d of dishRows) {
              if (d.vertaling_nl) vertalingByName.set(d.name, d.vertaling_nl);
            }
            const dishTranslationsMap = vertalingByName.size > 0 ? Object.fromEntries(vertalingByName) : undefined;
            for (const r of results) {
              const m = matchByRestaurant.get(r.id);
              if (m) (r as any).signatureDish = { name: m.name, price: m.price };
              if (dishTranslationsMap) (r as any).dishTranslations = dishTranslationsMap;
            }
            results.sort((a, b) => {
              if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
              if (a.is_top_listing !== b.is_top_listing) return a.is_top_listing ? -1 : 1;
              return (b.rating || 0) - (a.rating || 0);
            });
            // Strict: only restaurants that actually have a matched approved dish
            const filteredResults = results.filter(r => (r as any).signatureDish);
            setRestaurants(filteredResults);

            // Hub only: build "Specifieke cuts" member list — canonical members
            // (excluding the hub itself) with ≥1 matching restaurant in this city.
            if (isHubPage) {
              const inCityIds = new Set(filteredResults.map(r => r.id));
              const memberCounts = new Map<string, { count: number; name: string; slug: string; translation: string | null }>();
              // Representative name per canonical (prefer canonical dish row)
              const canonicalRepName = new Map<string, string>();
              const canonicalRepTranslation = new Map<string, string | null>();
              for (const d of dishRows) {
                const canon = (d.canonical_slug && d.canonical_slug.length > 0) ? d.canonical_slug : d.slug;
                if (canon === canonicalSlug) continue; // skip hub itself
                if (d.slug === canon) {
                  canonicalRepName.set(canon, d.name);
                  canonicalRepTranslation.set(canon, d.vertaling_nl ?? null);
                } else if (!canonicalRepName.has(canon)) {
                  canonicalRepName.set(canon, d.name);
                  canonicalRepTranslation.set(canon, d.vertaling_nl ?? null);
                }
              }
              for (const [rid, canons] of restaurantCanonicalMatches) {
                if (!inCityIds.has(rid)) continue;
                for (const canon of canons) {
                  if (canon === canonicalSlug) continue;
                  const cur = memberCounts.get(canon);
                  const name = canonicalRepName.get(canon) || canon;
                  const translation = canonicalRepTranslation.get(canon) ?? null;
                  if (cur) cur.count += 1;
                  else memberCounts.set(canon, { count: 1, name, slug: canon, translation });
                }
              }
              const members = Array.from(memberCounts.values())
                .filter(m => m.count > 0)
                .sort((a, b) => b.count - a.count);

              // Look up SEO landing slugs for each canonical member in this city
              if (members.length > 0) {
                const memberSlugs = members.map(m => m.slug);
                const { data: memberDishRows } = await supabase
                  .from('dishes')
                  .select('id, slug')
                  .in('slug', memberSlugs);
                const dishIdBySlug = new Map<string, string>();
                for (const d of (memberDishRows || []) as any[]) dishIdBySlug.set(d.slug, d.id);
                const memberDishIds = Array.from(dishIdBySlug.values());
                let seoBySlug = new Map<string, string>();
                if (memberDishIds.length > 0) {
                  const { data: seoRows } = await supabase
                    .from('seo_landing_pages')
                    .select('slug, dish_id')
                    .eq('city_id', effectivePageData.city_id)
                    .eq('is_active', true)
                    .in('dish_id', memberDishIds);
                  const seoByDishId = new Map<string, string>();
                  for (const r of (seoRows || []) as any[]) if (r.dish_id) seoByDishId.set(r.dish_id, r.slug);
                  for (const [dSlug, dId] of dishIdBySlug) {
                    const s = seoByDishId.get(dId);
                    if (s) seoBySlug.set(dSlug, s);
                  }
                }
                setGroupMembers(members.map(m => ({
                  slug: m.slug,
                  name: m.name,
                  translation: m.translation,
                  count: m.count,
                  seoSlug: seoBySlug.get(m.slug) || null,
                })));
              } else {
                setGroupMembers([]);
              }
            } else {
              setGroupMembers([]);
            }
          } else {
            const { data: cityRestaurants } = await supabase
              .from('restaurants')
              .select('*')
              .eq('city_id', effectivePageData.city_id)
              .eq('is_active', true)
              .order('is_featured', { ascending: false })
              .order('rating', { ascending: false })
              .limit(12);
            setRestaurants(cityRestaurants || []);
            setGroupMembers([]);
          }

          // Member pages: expose parent hub link (dish_group set and ≠ canonical of this dish)
          if (!isHubPage && dishGroup && dishGroup !== canonicalSlug) {
            // Find the hub dish (the one whose slug === dish_group)
            const { data: hubDish } = await supabase
              .from('dishes')
              .select('id, name, slug')
              .eq('slug', dishGroup)
              .maybeSingle();
            if (hubDish) {
              const { data: hubSeo } = await supabase
                .from('seo_landing_pages')
                .select('slug')
                .eq('city_id', effectivePageData.city_id)
                .eq('is_active', true)
                .eq('dish_id', hubDish.id)
                .maybeSingle();
              setParentHub({
                slug: hubSeo?.slug || null,
                name: hubDish.name,
                dishSlug: hubDish.slug,
              });
            } else {
              setParentHub(null);
            }
          } else {
            setParentHub(null);
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

  return { page, restaurants, loading, error, redirectTo, canonicalDishName, isHub, groupMembers, parentHub, synthesized };
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
