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
  };
  city?: {
    id: string;
    name: string;
    slug: string;
  };
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
}

export function useSeoLandingPage(slug: string | undefined) {
  const [page, setPage] = useState<SeoLandingPage | null>(null);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            .select('id, name, slug')
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

        // Fetch restaurants that serve this dish in this city
        if (pageData.dish_id && pageData.city_id) {
          const { data: restaurantDishes } = await supabase
            .from('restaurant_dishes')
            .select('restaurant_id')
            .eq('dish_id', pageData.dish_id);

          if (restaurantDishes && restaurantDishes.length > 0) {
            const restaurantIds = restaurantDishes.map(rd => rd.restaurant_id);

            const { data: restaurantsData } = await supabase
              .from('restaurants')
              .select('*')
              .in('id', restaurantIds)
              .eq('city_id', pageData.city_id)
              .eq('is_active', true)
              .order('is_featured', { ascending: false })
              .order('is_top_listing', { ascending: false })
              .order('rating', { ascending: false });

            setRestaurants(restaurantsData || []);
          } else {
            // Fallback: get all restaurants in city
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

  return { page, restaurants, loading, error };
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
