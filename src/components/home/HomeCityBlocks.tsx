import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowLeftRight, ChevronDown, Loader2, LocateFixed, MapPin, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  cityCameFromLocation, openCityPicker, setVisitorCity, useHomepageCities, useLocateVisitorCity, useVisitorCity, type VisitorCity,
} from '@/lib/visitorCity';
import { useCitySpotlight, useCityToppleks } from '@/lib/paidPlacements';
import { CityPageChips, CitySpotlightSection, CityToppleksSection, Photo, useRestaurantsByIds } from '@/components/paid/CityPaidSections';
import { WhyPaidLink } from '@/components/paid/PaidLabel';
import { PaidTracked } from '@/components/paid/PaidTracked';
import { useCollections } from '@/hooks/useCollections';
import { optimizedImage } from '@/lib/imageUrl';
import { UpcomingEvents } from '@/components/home/UpcomingEvents';

/**
 * The homepage below the search bar, driven by one city: the one in the search bar (kept on the device).
 *
 * No city:  "In welke stad zoek je?" and the paid slot as "Spotlight in Nederland".
 * A city:   "Eten in <stad>", the same paid slot as "Spotlight in <stad>" (Stadsspotlight and
 *           Topplekken from that city only), then events, popular pages and the editors' picks.
 * A city with few or no payers shows an owner card in the open places; never another city's restaurants.
 */

const OWNER_PATH = '/voor-restaurants/plekken-en-bieden';

/** RPCs that are not in the generated types yet. */
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T[]> {
  const call = supabase.rpc as unknown as (n: string, a: Record<string, unknown>) => Promise<{ data: T[] | null; error: unknown }>;
  const { data, error } = await call(name, args);
  if (error) throw error;
  return data ?? [];
}

function OwnerCard({ where, compact = false }: { where: string; compact?: boolean }) {
  return (
    <Link to={OWNER_PATH}
      className={`flex rounded-2xl border-2 border-dashed border-primary/40 bg-card text-left transition-colors hover:border-primary ${
        compact ? 'flex-wrap items-center gap-x-3 gap-y-2 p-4' : 'w-[78vw] max-w-sm flex-none snap-start flex-col justify-center gap-2 p-5 md:w-auto md:max-w-none'}`}>
      <Store className="h-6 w-6 flex-none text-primary" aria-hidden="true" />
      <span className="min-w-[10rem] flex-1">
        <span className="block font-semibold">Jouw restaurant hier?</span>
        <span className="block text-sm text-muted-foreground">Nog plek in {where} deze week</span>
      </span>
      <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Bekijk de plekken <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
    </Link>
  );
}

function SlotHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="spotlight-slot-heading" className="text-2xl font-bold md:text-3xl">{title}</h2>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">Betaald</span>
        <WhyPaidLink className="ml-auto" />
      </div>
      <p className="text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

const slotClass = 'scroll-mt-24 space-y-6 rounded-3xl bg-accent/40 p-4 md:p-6';

/** The paid slot without a city: one paying restaurant per city, the city on every card. */
function SpotlightNederland() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['national-uitgelicht'],
    queryFn: () => rpc<{ restaurant_id: string; city_id: string; city_name: string; page_slug: string }>('national_uitgelicht', { p_limit: 4 }),
    staleTime: 5 * 60_000,
  });
  const { data: map } = useRestaurantsByIds(items.map(i => i.restaurant_id));
  const rows = items.map(i => ({ ...i, r: map?.get(i.restaurant_id) })).filter(x => x.r);
  if (isLoading) return null;
  if (!rows.length) {
    return (
      <section aria-labelledby="spotlight-slot-heading" className={slotClass}>
        <h2 id="spotlight-slot-heading" className="text-lg font-bold">Spotlight in Nederland</h2>
        <OwnerCard where="Nederland" compact />
      </section>
    );
  }
  return (
    <section aria-labelledby="spotlight-slot-heading" className={slotClass}>
      <SlotHeading title="Spotlight in Nederland" sub="Restaurants die zich deze week laten zien. Elk gerecht staat echt op hun kaart." />
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
        {rows.map(({ r, city_name, page_slug }) => (
          <PaidTracked key={r!.id} restaurantId={r!.id} pageSlug={page_slug} surface={page_slug === 'spotlight' ? 'spotlight' : 'homepage'}>
            <Link to={`/restaurant/${r!.slug}`} className="block w-[70vw] max-w-xs flex-none snap-start overflow-hidden rounded-2xl border bg-card md:w-auto md:max-w-none">
              <Photo r={r!} className="h-36 w-full" />
              <div className="space-y-1 p-3">
                <p className="font-semibold">{r!.name}</p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {city_name}{r!.cuisines?.[0] ? ` · ${r!.cuisines[0]}` : ''}
                </p>
              </div>
            </Link>
          </PaidTracked>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">Kies je stad hierboven voor de spotlight bij jou in de buurt.</p>
    </section>
  );
}

/** The paid slot for a city: Stadsspotlight and Topplekken from this city only, owner cards in open places. */
function SpotlightStad({ city }: { city: VisitorCity }) {
  const spot = useCitySpotlight(city.id);
  const tops = useCityToppleks(city.id);
  if (spot.isLoading || tops.isLoading) return null;
  const spotCount = spot.data?.length ?? 0;
  const topCount = tops.data?.length ?? 0;
  if (!spotCount && !topCount) {
    return (
      <section aria-labelledby="spotlight-slot-heading" className={slotClass}>
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 id="spotlight-slot-heading" className="text-lg font-bold">Spotlight in {city.name}</h2>
          <span className="text-sm text-muted-foreground">Nog geen restaurant deze week.</span>
        </div>
        <OwnerCard where={city.name} compact />
      </section>
    );
  }
  return (
    <section aria-labelledby="spotlight-slot-heading" className={slotClass}>
      <SlotHeading title={`Spotlight in ${city.name}`} sub={`Alleen restaurants uit ${city.name}. Elk gerecht staat echt op hun kaart.`} />
      {spotCount > 0
        ? <CitySpotlightSection nested cityId={city.id} cityName={city.name} extra={spotCount < 3 ? <OwnerCard where={city.name} /> : undefined} />
        : <OwnerCard where={city.name} compact />}
      <CityToppleksSection nested cityId={city.id} cityName={city.name} citySlug={city.slug} />
    </section>
  );
}

function LocateButton() {
  const { locate, loading } = useLocateVisitorCity();
  return (
    <button type="button" onClick={locate} disabled={loading}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline disabled:opacity-60">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <LocateFixed className="h-4 w-4" aria-hidden="true" />}
      Gebruik mijn locatie
    </button>
  );
}

/** No city yet: the biggest cities as one-tap choices. */
function CityChooser() {
  const { data: cities = [] } = useHomepageCities();
  return (
    <section aria-labelledby="choose-city-heading" className="space-y-4">
      <div>
        <h2 id="choose-city-heading" className="text-2xl font-bold md:text-3xl">In welke stad zoek je?</h2>
        <p className="text-sm text-muted-foreground">Dan laten we zien waar je daar het lekkerste eet.</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cities.slice(0, 8).map(c => (
          <li key={c.id}>
            <button type="button" onClick={() => setVisitorCity({ id: c.id, name: c.name, slug: c.slug })}
              className="flex min-h-14 w-full items-center gap-2.5 rounded-2xl border bg-card px-4 text-left font-semibold transition-colors hover:border-primary">
              <MapPin className="h-4 w-4 flex-none text-primary" aria-hidden="true" />{c.name}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LocateButton />
        <Link to="/steden" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          Alle plaatsen <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function CityHeader({ city }: { city: VisitorCity }) {
  return (
    <div className="space-y-2">
      {cityCameFromLocation() && (
        <p className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-foreground">
          <LocateFixed className="h-4 w-4" aria-hidden="true" />Op basis van je locatie: {city.name}
        </p>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold md:text-3xl">Eten in {city.name}</h2>
        <button type="button" onClick={openCityPicker}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />Andere stad
        </button>
      </div>
      <p className="text-sm text-muted-foreground">Alles hieronder gaat over {city.name}.</p>
    </div>
  );
}

const DISHLOOPR_COLLECTION = 'getest-door-dishloopr';

/** Collections with photo: "Getest door Dishloopr" first, then the rest in their own order. */
function HomeCollections() {
  const { collections } = useCollections();
  const [expanded, setExpanded] = useState(false);
  const list = [...collections].sort((x, y) =>
    (x.slug === DISHLOOPR_COLLECTION ? -1 : 0) - (y.slug === DISHLOOPR_COLLECTION ? -1 : 0) || x.sort_order - y.sort_order);
  if (!list.length) return null;
  return (
    <section aria-labelledby="collections-heading" className="space-y-3 md:space-y-4">
      <h2 id="collections-heading" className="text-xl font-bold md:text-3xl">Collecties</h2>
      <ul className="grid grid-cols-3 gap-2 md:grid-cols-3 md:gap-3 lg:grid-cols-4">
        {list.map((c, i) => (
          <li key={c.id} className={!expanded && i >= 6 ? 'hidden md:block' : ''}>
            <Link to={`/collection/${c.slug}`} className="block h-full overflow-hidden rounded-2xl border bg-card">
              {c.cover_image ? (
                <img src={optimizedImage(c.cover_image, { width: 400 })} alt="" width={400} height={300} loading="lazy" decoding="async"
                  className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-primary/15 p-1.5 text-center text-[10px] font-bold md:p-4 md:text-base text-primary">{c.title}</div>
              )}
              <div className="p-1.5 md:p-3">
                <p className="line-clamp-2 text-[11px] font-semibold leading-snug md:text-base">{c.title}</p>
                {c.subtitle && <p className="mt-0.5 line-clamp-1 text-[10px] md:line-clamp-2 md:text-sm text-muted-foreground">{c.subtitle}</p>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {list.length > 6 && (
        <button type="button" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline">
          {expanded ? 'Zie minder' : 'Zie meer'}
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </section>
  );
}

export function HomeCityBlocks() {
  const { city } = useVisitorCity();
  return (
    <div id="stad" className="container scroll-mt-24 space-y-10 px-4 py-8 md:px-6">
      {!city ? (<>
        <CityChooser />
        <SpotlightNederland />
      </>) : (<>
        <CityHeader city={city} />
        <SpotlightStad city={city} />
        <div id="events" className="-mx-4 scroll-mt-24 md:-mx-6"><UpcomingEvents city={city} /></div>
        <CityPageChips cityId={city.id} cityName={city.name} />
        <HomeCollections />
      </>)}
    </div>
  );
}
