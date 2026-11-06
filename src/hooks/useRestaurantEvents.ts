import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PUBLIC_EVENT_DETAIL_SELECT, PUBLIC_EVENT_SELECT, compareByNextOccurrence, type PublicEvent } from '@/lib/events';

const PAGE_SIZE = 500;

function normalize(rows: unknown[]): PublicEvent[] {
  return (rows as PublicEvent[]).map(e => ({ ...e, price: e.price != null ? Number(e.price) : null }));
}

/** RLS only returns released (paid or admin-approved) events that are still running. */
async function fetchPublicEvents(restaurantId?: string): Promise<PublicEvent[]> {
  const all: PublicEvent[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let q = supabase.from('restaurant_events').select(PUBLIC_EVENT_SELECT).order('event_date').order('id').range(from, from + PAGE_SIZE - 1);
    if (restaurantId) q = q.eq('restaurant_id', restaurantId);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...normalize(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return all.sort(compareByNextOccurrence);
}

/** All public events, for /evenementen and the homepage teaser. */
export function usePublicEvents() {
  return useQuery({ queryKey: ['public-events', 'all'], queryFn: () => fetchPublicEvents(), staleTime: 5 * 60 * 1000 });
}

/** Active specials of one restaurant, for the restaurant page. */
export function useRestaurantEvents(restaurantId?: string) {
  const query = useQuery({
    queryKey: ['public-events', 'restaurant', restaurantId],
    queryFn: () => fetchPublicEvents(restaurantId),
    enabled: Boolean(restaurantId),
    staleTime: 5 * 60 * 1000,
  });
  return { events: query.data ?? [], loading: query.isLoading && Boolean(restaurantId) };
}

export function usePublicEvent(eventId?: string) {
  return useQuery({
    queryKey: ['public-event', eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_events')
        .select(PUBLIC_EVENT_DETAIL_SELECT)
        .eq('id', eventId!)
        .maybeSingle();
      if (error) throw error;
      return data ? normalize([data])[0] : null;
    },
    enabled: Boolean(eventId),
  });
}
