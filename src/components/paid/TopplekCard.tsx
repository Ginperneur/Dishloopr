import { Link, useLocation } from 'react-router-dom';
import { ImageOff, Star } from 'lucide-react';
import { optimizedImage, optimizedSrcSet } from '@/lib/imageUrl';
import { trackPaidMetric, usePaidImpression, type PaidSurface } from '@/lib/paidPlacements';
import { PaidLabel, WhyPaidLink } from '@/components/paid/PaidLabel';

interface TopplekRestaurant {
  id: string; name: string; slug: string; address?: string | null; rating?: number | null; review_count?: number | null;
  images?: string[] | null; cuisines?: string[] | null; signatureDish?: { name: string; price: number | null };
}

const euro = (n: number) => `€${n.toFixed(2).replace('.', ',')}`;

/** The one Topplek of a page: a wide card above Uitgelicht and the organic list. */
export function TopplekCard({ restaurant, pageSlug, founding = false, surface = 'gerechtpagina' }: {
  restaurant: TopplekRestaurant; pageSlug: string; founding?: boolean; surface?: PaidSurface;
}) {
  const location = useLocation();
  const ref = usePaidImpression<HTMLElement>(restaurant.id, pageSlug, surface);
  const image = restaurant.images?.[0];
  return (
    <article ref={ref} className="overflow-hidden rounded-2xl border-2 border-primary/60 bg-card shadow-sm" aria-label={`Topplek: ${restaurant.name}`}>
      <Link
        to={`/restaurant/${restaurant.slug}`}
        state={{ from: `${location.pathname}${location.search}` }}
        onClick={() => trackPaidMetric(restaurant.id, pageSlug, surface, 'klik')}
        className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
      >
        <div className="relative aspect-[16/10] bg-muted md:aspect-auto md:min-h-[260px]">
          {image ? (
            <img src={optimizedImage(image, { width: 720 })} srcSet={optimizedSrcSet(image, 720)}
              width={720} height={450} alt={restaurant.name}
              className="absolute inset-0 h-full w-full object-cover" loading="eager" decoding="async" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center"><ImageOff className="h-12 w-12 text-muted-foreground/40" aria-hidden="true" /></div>
          )}
        </div>
        <div className="flex flex-col gap-3 p-5 md:p-7">
          <PaidLabel kind="topplek" founding={founding} />
          <h2 className="font-display text-2xl font-bold md:text-3xl">{restaurant.name}</h2>
          <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {Number(restaurant.rating) > 0 && (<>
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden="true" />
              <span className="font-semibold text-foreground">{Number(restaurant.rating).toFixed(1).replace('.', ',')}</span>
              {restaurant.review_count ? <span>({restaurant.review_count})</span> : null}
              <span aria-hidden="true">·</span>
            </>)}
            {restaurant.cuisines?.[0] && <span>{restaurant.cuisines[0]}</span>}
            {restaurant.address && <span className="truncate">{restaurant.address}</span>}
          </p>
          {restaurant.signatureDish && (
            <p className="text-sm">
              <span className="font-medium">{restaurant.signatureDish.name}</span>
              {restaurant.signatureDish.price != null && <span className="text-muted-foreground"> {euro(restaurant.signatureDish.price)}</span>}
            </p>
          )}
          <span className="mt-auto inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-5 font-semibold text-primary-foreground sm:w-auto sm:self-start">
            Bekijk restaurant en menu
          </span>
        </div>
      </Link>
      <div className="flex justify-end border-t px-5 py-2"><WhyPaidLink /></div>
    </article>
  );
}
