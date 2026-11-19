import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useGeolocation } from '@/hooks/useGeolocation';
import { cityNear, useHomepageCities, useVisitorCity, type VisitorCity } from '@/lib/visitorCity';
import { CityPageChips, CitySpotlightSection, CityToppleksSection } from '@/components/paid/CityPaidSections';
import { UpcomingEvents } from '@/components/home/UpcomingEvents';

/** The visitor's city: chosen, or found from their location on request. Never guessed silently. */
function CityPicker({ city, onChoose }: { city: VisitorCity | null; onChoose: (c: VisitorCity | null) => void }) {
  const { data: cities = [] } = useHomepageCities();
  const { requestLocation, latitude, longitude, loading, error } = useGeolocation();
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    if (!asked || latitude == null || longitude == null) return;
    setAsked(false);
    cityNear(latitude, longitude)
      .then(c => (c ? onChoose(c) : toast.info('We vonden geen stad bij je in de buurt. Kies er een.')))
      .catch(() => toast.error('Je stad bepalen lukte niet. Kies er een.'));
  }, [asked, latitude, longitude, onChoose]);
  useEffect(() => { if (asked && error) { setAsked(false); toast.error(error); } }, [asked, error]);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="home-city" className="sr-only">Stad</label>
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" aria-hidden="true" />Je stad</span>
      <select id="home-city" value={city?.id ?? ''}
        onChange={e => onChoose(cities.find(c => c.id === e.target.value) ?? (city?.id === e.target.value ? city : null))}
        className="min-h-11 rounded-full border bg-card px-4 text-sm font-semibold">
        <option value="">Kies je stad</option>
        {city && !cities.some(c => c.id === city.id) && <option value={city.id}>{city.name}</option>}
        {cities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <button type="button" onClick={() => { setAsked(true); requestLocation(); }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-primary hover:underline">
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Gebruik mijn locatie
      </button>
    </div>
  );
}

/** "Getest door Dishloopr": shown from 3 tested restaurants in the city, a short teaser before that. */
function TestedSection({ city }: { city: VisitorCity }) {
  const { data = [] } = useQuery({
    queryKey: ['city-tested', city.id],
    queryFn: async () => {
      const { data: rows, error } = await (supabase.rpc as any)('city_tested_restaurants', { p_city: city.id });
      if (error) throw error;
      const list = (rows ?? []) as { restaurant_id: string; reason: string | null; collection_slug: string; collection_title: string }[];
      if (list.length < 3) return [];
      const { data: rs } = await supabase.from('restaurants').select('id, name, slug').in('id', list.map(r => r.restaurant_id));
      const byId = new Map((rs ?? []).map(r => [r.id, r]));
      return list.map(r => ({ ...r, r: byId.get(r.restaurant_id) })).filter(x => x.r);
    },
    staleTime: 10 * 60_000,
  });
  if (!data.length) {
    return (
      <section aria-labelledby="tested-heading" className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed p-6">
        <div className="max-w-xl space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-accent-foreground">Binnenkort</p>
          <h2 id="tested-heading" className="text-xl font-bold">Getest door Dishloopr</h2>
          <p className="text-sm text-muted-foreground">We gaan langs bij restaurants in {city.name}, betalen zelf de rekening en zetten hier de beste neer. Niet te koop.</p>
        </div>
      </section>
    );
  }
  return (
    <section aria-labelledby="tested-heading" className="space-y-4">
      <h2 id="tested-heading" className="text-2xl font-bold md:text-3xl">Getest door Dishloopr</h2>
      <p className="text-sm text-muted-foreground">We gingen zelf langs en betaalden de rekening. Niet te koop.</p>
      <ul className="grid gap-3 md:grid-cols-3">
        {data.slice(0, 6).map(x => (
          <li key={x.restaurant_id}>
            <Link to={`/restaurant/${x.r!.slug}`} className="block h-full rounded-2xl border bg-card p-4">
              <p className="font-semibold">{x.r!.name}</p>
              {x.reason && <p className="mt-1 text-sm text-muted-foreground">{x.reason}</p>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Homepage blocks for the visitor's city, from top to bottom: Stadsspotlight, Topplekken,
 *  events, popular dishes and cuisines, Getest door Dishloopr. */
export function HomeCityBlocks() {
  const { city, choose } = useVisitorCity();
  return (
    <section id="stad" aria-label="Jouw stad" className="container scroll-mt-24 space-y-12 px-4 py-8 md:px-6">
      <CityPicker city={city} onChoose={choose} />
      {!city ? (
        <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          Kies je stad of gebruik je locatie. Dan zie je wat er deze week in jouw stad te doen is en waar ze het beste eten hebben.
        </p>
      ) : (<>
        <CitySpotlightSection cityId={city.id} cityName={city.name} />
        <CityToppleksSection cityId={city.id} cityName={city.name} citySlug={city.slug} />
        <div className="-mx-4 md:-mx-6"><UpcomingEvents city={city} /></div>
        <CityPageChips cityId={city.id} cityName={city.name} />
        <TestedSection city={city} />
      </>)}
    </section>
  );
}
