import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, MapPin, Tag } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead, createBreadcrumbSchema } from '@/components/seo/SEOHead';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { usePublicEvent } from '@/hooks/useRestaurantEvents';
import { eventTypeLabel, formatEventPrice, formatSchedule } from '@/lib/events';
import { trackEventMetric } from '@/lib/eventMetrics';
import { optimizedImage, optimizedSrcSet, imgLoadingProps } from '@/lib/imageUrl';

const IMG_W = 960;
const IMG_H = 540;

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data: event, isLoading } = usePublicEvent(eventId);

  const viewedId = event?.id;
  useEffect(() => {
    if (viewedId) trackEventMetric(viewedId, 'bekeken');
  }, [viewedId]);

  if (isLoading) {
    return (
      <Layout>
        <div className="container max-w-3xl space-y-4 py-8">
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      </Layout>
    );
  }

  if (!event) {
    return (
      <Layout>
        <SEOHead title="Evenement niet gevonden | Dishloopr" description="Dit evenement is afgelopen of niet meer beschikbaar." noindex />
        <div className="container max-w-xl py-16 text-center">
          <CalendarDays className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
          <h1 className="font-display text-2xl font-bold">Dit evenement is niet meer beschikbaar</h1>
          <p className="mt-2 text-muted-foreground">Het is afgelopen of door het restaurant gestopt.</p>
          <Button asChild className="mt-6 min-h-11"><Link to="/evenementen">Bekijk andere specials</Link></Button>
        </div>
      </Layout>
    );
  }

  const r = event.restaurant;
  const image = event.image_url || r?.images?.[0];
  const price = formatEventPrice(event.price);
  const schedule = formatSchedule(event);
  const cta = r?.reservation_url || r?.website_url;
  const url = `https://dishloopr.com/evenementen/${event.id}`;
  const description = event.description || `${eventTypeLabel(event.event_type)} bij ${r?.name ?? 'dit restaurant'}. ${schedule}.`;

  return (
    <Layout>
      <SEOHead
        title={`${event.title} bij ${r?.name ?? 'restaurant'} | Dishloopr`}
        description={description.slice(0, 160)}
        canonical={url}
        ogImage={image ? optimizedImage(image, { width: 1200 }) : undefined}
        structuredData={{
          '@context': 'https://schema.org',
          '@graph': [
            createBreadcrumbSchema([
              { name: 'Home', url: 'https://dishloopr.com' },
              { name: 'Evenementen', url: 'https://dishloopr.com/evenementen' },
              { name: event.title, url },
            ]),
            ...(event.recurrence === 'none' && r ? [{
              '@type': 'Event',
              name: event.title,
              description,
              startDate: event.event_date,
              ...(event.end_date ? { endDate: event.end_date } : {}),
              eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
              eventStatus: 'https://schema.org/EventScheduled',
              location: { '@type': 'Restaurant', name: r.name, url: `https://dishloopr.com/restaurant/${r.slug}` },
              ...(image ? { image: [image] } : {}),
              ...(event.price != null ? { offers: { '@type': 'Offer', price: event.price, priceCurrency: 'EUR', url } } : {}),
            }] : []),
          ],
        }}
      />

      <article className="container max-w-3xl py-6 md:py-10">
        <Link to="/evenementen" className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Alle evenementen
        </Link>

        {image && (
          <img
            src={optimizedImage(image, { width: IMG_W })}
            srcSet={optimizedSrcSet(image, IMG_W)}
            alt=""
            width={IMG_W}
            height={IMG_H}
            {...imgLoadingProps(true)}
            className="mb-6 aspect-video w-full rounded-xl bg-muted object-cover"
          />
        )}

        <Badge variant="secondary">{eventTypeLabel(event.event_type)}</Badge>
        <h1 className="mt-3 font-display text-3xl font-bold leading-tight md:text-4xl">{event.title}</h1>

        <dl className="mt-5 space-y-3 text-base">
          <div className="flex gap-3">
            <dt className="sr-only">Wanneer</dt>
            <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <dd className="first-letter:uppercase">{schedule}</dd>
          </div>
          {r && (
            <div className="flex gap-3">
              <dt className="sr-only">Waar</dt>
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <dd>
                <Link to={`/restaurant/${r.slug}`} className="font-medium underline-offset-4 hover:underline">{r.name}</Link>
                {r.city?.name && <span className="text-muted-foreground">, {r.city.name}</span>}
              </dd>
            </div>
          )}
          {(event.offer || price) && (
            <div className="flex gap-3">
              <dt className="sr-only">Aanbieding</dt>
              <Tag className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <dd className="font-medium">{[event.offer, price].filter(Boolean).join(' · ')}</dd>
            </div>
          )}
        </dl>

        {event.description && <p className="mt-6 whitespace-pre-line leading-relaxed">{event.description}</p>}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {cta && (
            <Button asChild className="min-h-11">
              <a href={cta} target="_blank" rel="noopener noreferrer" onClick={() => trackEventMetric(event.id, 'klik')}>
                {r?.reservation_url ? 'Reserveer een tafel' : 'Naar de website'}
              </a>
            </Button>
          )}
          {r && (
            <Button asChild variant="outline" className="min-h-11">
              <Link to={`/restaurant/${r.slug}`}>Bekijk {r.name}</Link>
            </Button>
          )}
        </div>
      </article>
    </Layout>
  );
}
