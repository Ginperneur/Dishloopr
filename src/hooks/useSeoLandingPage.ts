import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadLandingContext, loadLandingRestaurants, loadLandingNavigation, landingIdentity } from '@/lib/seoLandingLoader';
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

export function useSeoLandingPage(slug: string | undefined) {
  const context = useQuery({
    queryKey: ['seo-landing-context', slug],
    queryFn: () => loadLandingContext(slug ?? ''),
    enabled: Boolean(slug), staleTime: 60_000,
  });
  const page = context.data?.page ?? null;
  const result = useQuery({
    queryKey: ['seo-landing-restaurants', slug],
    queryFn: () => {
      if (!page) throw new Error('Missing landing context');
      return loadLandingRestaurants(page);
    },
    enabled: Boolean(page && !context.data?.redirectTo), staleTime: 60_000,
  });
  const navigation = useQuery({
    queryKey: ['seo-landing-navigation', slug],
    queryFn: () => {
      if (!page) throw new Error('Missing landing context');
      return loadLandingNavigation(page);
    },
    enabled: Boolean(page && !context.data?.redirectTo), staleTime: 60_000,
  });
  const synthesized = context.data?.synthesized ?? false;
  const resultsLoading = Boolean(page && result.isPending);
  const notFound = context.isSuccess && !context.data.page && !context.data.redirectTo;
  const emptySynthesized = synthesized && result.isSuccess && !result.data.restaurants.length;
  return {
    page, restaurants: result.data?.restaurants ?? [],
    loading: Boolean(slug && context.isPending), resultsLoading,
    error: notFound || emptySynthesized ? 'Page not found' : context.error || result.error ? 'Failed to load page' : null,
    redirectTo: context.data?.redirectTo ?? null,
    canonicalDishName: page?.dish?.name ?? null,
    isHub: page ? landingIdentity(page).isHub : false,
    groupMembers: (result.data?.members ?? []).map(m => ({ ...m, seoSlug: navigation.data?.seoByCanonical[m.slug] ?? null })),
    parentHub: navigation.data?.parentHub ?? null,
    navigationLoading: Boolean(page?.dish?.dish_group && navigation.isPending),
    synthesized,
  };
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
    const { faq_content, dish: _dish, city: _city, ...rest } = updates as Partial<SeoLandingPage> & { dish?: unknown; city?: unknown };
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
