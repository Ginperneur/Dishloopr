import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * The city a visitor sees on the homepage (Stadsspotlight, Topplekken, events). In this order:
 * the city they chose or last searched (kept on this device), the city of their location when
 * they ask for it, otherwise nothing: the homepage then asks them to pick a city and never shows
 * another city's paid places.
 */
export interface VisitorCity { id: string; name: string; slug: string }

const KEY = 'dl_visitor_city_v1';
const EVENT = 'dl:visitor-city';

function read(): VisitorCity | null {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.id === 'string' && typeof v.name === 'string' && typeof v.slug === 'string' ? v : null;
  } catch { return null; }
}

export function setVisitorCity(city: VisitorCity | null): void {
  try {
    if (city) localStorage.setItem(KEY, JSON.stringify({ id: city.id, name: city.name, slug: city.slug }));
    else localStorage.removeItem(KEY);
  } catch { /* storage blocked: the choice lasts for this page view */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: city }));
}

export function useVisitorCity() {
  const [city, setCity] = useState<VisitorCity | null>(() => read());
  useEffect(() => {
    const on = (e: Event) => setCity((e as CustomEvent<VisitorCity | null>).detail ?? null);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const choose = useCallback((c: VisitorCity | null) => { setCity(c); setVisitorCity(c); }, []);
  return { city, choose };
}

export function useHomepageCities() {
  return useQuery({
    queryKey: ['homepage-cities'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('homepage_cities', {});
      if (error) throw error;
      return (data ?? []) as (VisitorCity & { pages: number })[];
    },
    staleTime: 10 * 60_000,
  });
}

export async function cityNear(lat: number, lng: number): Promise<VisitorCity | null> {
  const { data, error } = await (supabase.rpc as any)('nearest_city', { p_lat: lat, p_lng: lng });
  if (error) throw error;
  return ((data ?? []) as VisitorCity[])[0] ?? null;
}
