import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ImageOff } from 'lucide-react';
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
    : <div className={`${className} flex items-center justify-center bg-muted`}><ImageOff className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" /></div>;
}

/**
 * "Deze week in <stad>": the 3 Stadsspotlight places of this week. Nothing when none are booked.
 * `nested`: inside the homepage "Uitgelicht in <stad>" block, which carries the Betaald label;
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
        <h3 id="spotlight-heading" className="text-sm font-semibold text-muted-foreground">In de spotlight deze week</h3>
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

const pageLabel = (p: Pick<CityPage, 'page_kind' | 'subject'>) => (p.page_kind === 'ambience' ? 'Romantisch' : p.subject);

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
  const pages = only ? all.filter(p => only.includes(p.page_kind)) : all;
  if (!pages.length) return null;
  const group = (kind: CityPage['page_kind']) => pages.filter(p => p.page_kind === kind);
  const rows: [string, CityPage[]][] = [['Gerechten', group('dish').slice(0, 14)], ['Keukens', group('cuisine')], ['Sfeer', group('ambience')]];
  return (
    <section aria-labelledby="popular-pages-heading" className="space-y-4">
      <h2 id="popular-pages-heading" className="text-2xl font-bold md:text-3xl">{title ?? `Populair in ${cityName}`}</h2>
      {rows.filter(([, list]) => list.length).map(([label, list]) => (
        <div key={label} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {list.map(p => (
              <Link key={p.page_slug} to={`/eten/${p.page_slug}`}
                className="inline-flex min-h-10 flex-none items-center gap-1.5 rounded-full border bg-card px-3.5 text-sm hover:border-primary">
                {pageLabel(p)} <span className="text-xs text-muted-foreground">{p.restaurant_count}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Het getal is het aantal restaurants in {cityName}.</p>
    </section>
  );
}
