import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Collection {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
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
  city?: { name: string; slug: string } | null;
  dish?: { name: string; slug: string } | null;
}

export interface CollectionRestaurant {
  id: string;
  collection_id: string;
  restaurant_id: string;
  sort_order: number;
  featured_reason: string | null;
  restaurant: {
    id: string;
    name: string;
    slug: string;
    address: string;
    rating: number;
    review_count: number;
    price_level: number;
    cuisines: string[] | null;
    ambience_tags: string[] | null;
    images: string[] | null;
    is_featured: boolean;
    is_top_listing: boolean;
    city: { name: string } | null;
  };
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
        dish:dish_id (name, slug)
      `)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching collections:', error);
    } else {
      setCollections(data as unknown as Collection[]);
    }
    setLoading(false);
  };

  return { collections, loading, refetch: fetchCollections };
}

export function useCollection(slug: string | undefined) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [restaurants, setRestaurants] = useState<CollectionRestaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      fetchCollection(slug);
    }
  }, [slug]);

  const fetchCollection = async (collectionSlug: string) => {
    setLoading(true);

    // Fetch collection
    const { data: collectionData, error: collectionError } = await supabase
      .from('collections')
      .select(`
        *,
        city:city_id (name, slug),
        dish:dish_id (name, slug)
      `)
      .eq('slug', collectionSlug)
      .eq('is_active', true)
      .single();

    if (collectionError || !collectionData) {
      console.error('Error fetching collection:', collectionError);
      setLoading(false);
      return;
    }

    setCollection(collectionData as unknown as Collection);

    // Fetch restaurants in this collection
    const { data: restaurantData, error: restaurantError } = await supabase
      .from('collection_restaurants')
      .select(`
        *,
        restaurant:restaurant_id (
          id,
          name,
          slug,
          address,
          rating,
          review_count,
          price_level,
          cuisines,
          ambience_tags,
          images,
          is_featured,
          is_top_listing,
          city:city_id (name)
        )
      `)
      .eq('collection_id', collectionData.id)
      .order('sort_order', { ascending: true });

    if (restaurantError) {
      console.error('Error fetching collection restaurants:', restaurantError);
    } else {
      setRestaurants(restaurantData as unknown as CollectionRestaurant[]);
    }

    setLoading(false);
  };

  return { collection, restaurants, loading };
}
