import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { MoodImage } from '@/components/restaurant/MoodImage';
import { supabase } from '@/integrations/supabase/client';
import { optimizedImage } from '@/lib/imageUrl';
import { useCityPages, useCitySpotlight, useCityToppleks, type CityPage } from '@/lib/paidPlacements';
import { PaidLabel, WhyPaidLink } from '@/components/paid/PaidLabel';
import { PaidTracked } from '@/components/paid/PaidTracked';

export interface MiniRestaurant { id: string; name: string; slug: string; images: string[] | null; cuisines: string[] | null; rating: number | null }

export function useRestaurantsByIds(ids: string[]) {
  const key = [...ids].sort().join(',');
  return useQuery({
    queryKey: ['mini-restaurants', key],
    queryFn: async () => {
      const { data, error } = await supabase.from('restaurants').select('id, name, slug, images, cuisines, rating').in('id', ids).eq('is_active', true);
      if (error) throw error;
      return new Map((data ?? []).map(r => [r.id, r as MiniRestaurant]));
    },
    enabled: ids.length > 0, staleTime: 60_000,
  });
}

export function Photo({ r, className }: { r: MiniRestaurant; className: string }) {
  const src = r.images?.[0];
  return src
    ? <img src={optimizedImage(src, { width: 480 })} width={480} height={300} alt="" loading="lazy" decoding="async" className={`${className} object-cover`} />
    : <div className={`${className} relative overflow-hidden`}><MoodImage seed={r.id} name={r.name} cuisines={r.cuisines} /></div>;
}

/**
 * "Deze week in <stad>": the 3 Stadsspotlight places of this week. Nothing when none are booked.
 * `nested`: inside the homepage "Spotlight in <stad>" block, which carries the Betaald label;
 * `extra` fills an open place (the owner card).
 */
export function CitySpotlightSection({ cityId, cityName, nested = false, extra }: { cityId: string; cityName: string; nested?: boolean; extra?: ReactNode }) {
  const { data: items = [] } = useCitySpotlight(cityId);
  const { data: map } = useRestaurantsByIds(items.map(i => i.restaurant_id));
  const rows = items.map(i => ({ ...i, r: map?.get(i.restaurant_id) })).filter(x => x.r);
  if (!rows.length) return null;
  return (
    <section aria-labelledby="spotlight-heading" className={nested ? 'space-y-3' : 'space-y-4'}>
      {nested ? (
        <h3 id="spotlight-heading" className="text-sm font-semibold text-muted-foreground">Deze week</h3>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="spotlight-heading" className="text-2xl font-bold md:text-3xl">Deze week in {cityName}</h2>
          <PaidLabel kind="spotlight" />
          <WhyPaidLink className="ml-auto" />
        </div>
      )}
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {rows.map(({ r, headline, body }) => (
          <PaidTracked key={r!.id} restaurantId={r!.id} pageSlug="spotlight" surface="spotlight">
            <Link to={`/restaurant/${r!.slug}`} className="block w-[78vw] max-w-sm flex-none snap-start overflow-hidden rounded-2xl border bg-card md:w-auto md:max-w-none">
              <Photo r={r!} className="h-44 w-full" />
              <div className="space-y-1.5 p-4">
                <p className="text-sm font-semibold text-accent-foreground">{headline}</p>
                <h3 className="text-lg font-bold">{r!.name}</h3>
                {r!.cuisines?.[0] && <p className="text-sm text-muted-foreground">{r!.cuisines[0]}</p>}
                <p className="text-sm">{body}</p>
              </div>
            </Link>
          </PaidTracked>
        ))}
        {extra}
      </div>
    </section>
  );
}

// Dish subjects are stored lowercase (canonical names); show them with a capital letter. URLs stay untouched.
const pageLabel = (p: Pick<CityPage, 'page_kind' | 'subject'>) =>
  p.page_kind === 'ambience' ? 'Romantisch' : p.subject.charAt(0).toUpperCase() + p.subject.slice(1);

/** "Topplekken in <stad>": per dish, cuisine or Romantisch page the restaurant holding its Topplek. */
export function CityToppleksSection({ cityId, cityName, citySlug, limit = 7, nested = false }: { cityId: string; cityName: string; citySlug: string; limit?: number; nested?: boolean }) {
  const { data: tops = [] } = useCityToppleks(cityId);
  const { data: pages = [] } = useCityPages(cityId);
  const shown = tops.slice(0, limit);
  const { data: map } = useRestaurantsByIds(shown.map(t => t.restaurant_id));
  if (!shown.length) return null;
  const dishCount = pages.filter(p => p.page_kind === 'dish').length;
  const cuisineCount = pages.filter(p => p.page_kind === 'cuisine').length;
  return (
    <section aria-labelledby="toppleks-heading" className={nested ? 'space-y-3' : 'space-y-4'}>
      {nested ? (
        <h3 id="toppleks-heading" className="text-sm font-semibold text-muted-foreground">Topplekken per gerecht</h3>
      ) : (<>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="toppleks-heading" className="text-2xl font-bold md:text-3xl">Topplekken in {cityName}</h2>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">Betaald</span>
          <WhyPaidLink className="ml-auto" />
        </div>
        <p className="text-sm text-muted-foreground">Per gerecht het restaurant met de Topplek. Klik door voor alle restaurants met dat gerecht.</p>
      </>)}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {shown.map(t => {
          const r = map?.get(t.restaurant_id);
          if (!r) return null;
          return (
            <PaidTracked key={t.page_slug} restaurantId={r.id} pageSlug={t.page_slug} surface="homepage">
              <Link to={`/eten/${t.page_slug}`} className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card sm:flex-row sm:items-center sm:gap-3 sm:p-3">
                <Photo r={r} className="h-24 w-full sm:h-16 sm:w-16 sm:flex-none sm:rounded-xl" />
                <div className="min-w-0 space-y-1 p-3 sm:p-0">
                  <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">{pageLabel(t)}</span>
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">+{Math.max(0, t.restaurant_count - 1)} restaurants</p>
                </div>
              </Link>
            </PaidTracked>
          );
        })}
        {(dishCount + cuisineCount) > 0 && (
          <Link to={`/steden/${citySlug}`}
            className="flex min-h-[88px] flex-col justify-center rounded-2xl border border-dashed p-3">
            <p className="font-semibold">Alle gerechten</p>
            <p className="text-xs text-muted-foreground">{dishCount} gerechten{cuisineCount ? ` en ${cuisineCount} keukens` : ''} in {cityName}</p>
          </Link>
        )}
      </div>
    </section>
  );
}

/** Chips to every dish, cuisine and Romantisch page of a city, with the number of restaurants. Free. */
export function CityPageChips({ cityId, cityName, title, only }: { cityId: string; cityName: string; title?: string; only?: CityPage['page_kind'][] }) {
  const { data: all = [] } = useCityPages(cityId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const pages = only ? all.filter(p => only.includes(p.page_kind)) : all;
  if (!pages.length) return null;
  const group = (kind: CityPage['page_kind']) => pages.filter(p => p.page_kind === kind);
  const rows: [string, CityPage[]][] = [['Gerechten', group('dish')], ['Keukens', group('cuisine')], ['Sfeer', group('ambience')]];
  return (
    <section aria-labelledby="popular-pages-heading" className="space-y-3 md:space-y-4">
      <h2 id="popular-pages-heading" className="text-xl font-bold md:text-3xl">{title ?? `Populair in ${cityName}`}</h2>
      {rows.filter(([, list]) => list.length).map(([label, list]) => {
        const isOpen = !!expanded[label];
        // Mobile: collapsed shows one row of three chips; "Zie meer" adds rows of three, up to the top 12.
        // Desktop: collapsed the first 6, "Zie meer" up to the top 12.
        const hiddenClass = (i: number) => (isOpen ? (i < 12 ? '' : 'hidden') : i < 3 ? '' : i < 6 ? 'hidden md:inline-flex' : 'hidden');
        const rowClass = isOpen
          ? 'grid grid-cols-3 gap-1.5 md:flex md:flex-wrap md:gap-2'
          : 'scrollbar-hide -mx-4 flex flex-nowrap gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:gap-2 md:overflow-visible md:px-0';
        return (
        <div key={label} className="space-y-1.5 md:space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
          <div className={rowClass}>
            {list.map((p, i) => (
              <Link key={p.page_slug} to={`/eten/${p.page_slug}`}
                className={`inline-flex min-h-9 min-w-0 flex-none items-center gap-1 whitespace-nowrap overflow-hidden rounded-full border bg-card text-[13px] hover:border-primary md:min-h-10 md:gap-1.5 md:px-3.5 md:text-sm ${isOpen ? 'px-2 text-[12px]' : 'px-3'} ${hiddenClass(i)}`}>
                <span className="truncate">{pageLabel(p)}</span>
                <span className="flex-none text-[11px] text-muted-foreground md:text-xs">{p.restaurant_count}</span>
              </Link>
            ))}
          </div>
          {list.length > 3 && (
            <button type="button" onClick={() => setExpanded(prev => ({ ...prev, [label]: !prev[label] }))} aria-expanded={isOpen}
              className={`inline-flex min-h-9 flex-none items-center gap-1 whitespace-nowrap rounded-full px-0 text-[13px] font-medium text-primary hover:underline md:min-h-10 md:w-auto md:px-3 md:text-sm ${list.length <= 6 ? 'md:hidden' : ''}`}>
              {isOpen ? 'Zie minder' : 'Zie meer'}
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        );
      })}
      <p className="text-xs text-muted-foreground">Het getal is het aantal restaurants in {cityName}.</p>
    </section>
  );
}
