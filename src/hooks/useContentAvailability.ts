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
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase
        .from('restaurant_events')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('event_date', new Date().toISOString()),
    ]);
    const result = {
      hasCollections: (colRes.count || 0) > 0,
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