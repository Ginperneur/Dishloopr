import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Availability {
  hasCollections: boolean;
  hasEvents: boolean;
  loading: boolean;
}

let cached: { hasCollections: boolean; hasEvents: boolean } | null = null;
let inflight: Promise<{ hasCollections: boolean; hasEvents: boolean }> | null = null;

async function load() {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const [colRes, evRes] = await Promise.all([
      supabase
        .from('collections')
        .select('id, collection_restaurants(count)')
        .eq('is_active', true),
      supabase
        .from('restaurant_events')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('event_date', new Date().toISOString()),
    ]);
    const visibleCollections = (colRes.data || []).filter((c: any) => {
      const cr = c.collection_restaurants;
      const count = Array.isArray(cr) ? (cr[0]?.count ?? 0) : (cr?.count ?? 0);
      return count > 0;
    });
    const result = {
      hasCollections: visibleCollections.length > 0,
      hasEvents: (evRes.count || 0) > 0,
    };
    cached = result;
    return result;
  })();
  return inflight;
}

export function useContentAvailability(): Availability {
  const [state, setState] = useState<Availability>(() => ({
    hasCollections: cached?.hasCollections ?? false,
    hasEvents: cached?.hasEvents ?? false,
    loading: !cached,
  }));

  useEffect(() => {
    let cancelled = false;
    load().then((r) => {
      if (!cancelled) setState({ ...r, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}