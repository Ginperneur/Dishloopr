import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RestaurantEvent {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  event_type: string;
  event_date: string;
  end_date: string | null;
  price: number | null;
  max_participants: number | null;
  current_participants: number;
  image_url: string | null;
}

export function useRestaurantEvents(restaurantId?: string, cityId?: string) {
  const [events, setEvents] = useState<RestaurantEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('restaurant_events')
          .select('*')
          .eq('is_active', true)
          .gte('event_date', new Date().toISOString())
          .order('event_date');

        if (restaurantId) {
          query = query.eq('restaurant_id', restaurantId);
        }

        const { data, error: fetchError } = await query.limit(10);

        if (fetchError) throw fetchError;

        setEvents((data || []).map(e => ({
          ...e,
          price: e.price ? Number(e.price) : null,
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load events');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [restaurantId, cityId]);

  return { events, loading, error };
}
