import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation } from '@/hooks/useGeolocation';

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
  lastViaLocation = false;
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

// --- Whether the current city came from the visitor's location (this page view only) ---
let lastViaLocation = false;
export function cityCameFromLocation(): boolean { return lastViaLocation; }

/**
 * "Mijn locatie": asks for the position, finds the nearest city and makes it the visitor's city.
 * Shared by the search bar and the homepage city chooser so both behave the same.
 */
export function useLocateVisitorCity(onDone?: (c: VisitorCity) => void) {
  const { requestLocation, latitude, longitude, loading, error } = useGeolocation();
  const [asked, setAsked] = useState(false);
  const [finding, setFinding] = useState(false);
  useEffect(() => {
    if (!asked || latitude == null || longitude == null) return;
    setAsked(false);
    setFinding(true);
    cityNear(latitude, longitude)
      .then(c => {
        if (!c) { toast.info('We vonden geen stad bij je in de buurt. Kies er een.'); return; }
        setVisitorCity(c);
        lastViaLocation = true; // after setVisitorCity, which resets it; read on the next render
        onDone?.(c);
      })
      .catch(() => toast.error('Je stad bepalen lukte niet. Kies er een.'))
      .finally(() => setFinding(false));
  }, [asked, latitude, longitude, onDone]);
  useEffect(() => { if (asked && error) { setAsked(false); toast.error(error); } }, [asked, error]);
  const locate = useCallback(() => { setAsked(true); requestLocation(); }, [requestLocation]);
  return { locate, loading: loading || finding };
}

// --- "Andere stad" anywhere on the homepage opens the one city picker in the search bar ---
const OPEN_PICKER = 'dl:open-city-picker';
export function openCityPicker(): void { window.dispatchEvent(new Event(OPEN_PICKER)); }
export function useOpenCityPickerListener(open: () => void): void {
  useEffect(() => {
    window.addEventListener(OPEN_PICKER, open);
    return () => window.removeEventListener(OPEN_PICKER, open);
  }, [open]);
}
