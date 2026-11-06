import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarDays, MapPin, PartyPopper, Tags } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead, createBreadcrumbSchema } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EventCard } from '@/components/events/EventCard';
import { usePublicEvents } from '@/hooks/useRestaurantEvents';
import { EVENT_TYPES, eventTypeLabel } from '@/lib/events';

const ALL = 'alle';

export default function EventsPage() {
  const [params, setParams] = useSearchParams();
  const city = params.get('stad') || ALL;
  const type = params.get('type') || ALL;
  const { data: events = [], isLoading } = usePublicEvents();

  const cities = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) if (e.restaurant?.city) map.set(e.restaurant.city.slug, e.restaurant.city.name);
    return [...map].sort((a, b) => a[1].localeCompare(b[1], 'nl'));
  }, [events]);

  const types = useMemo(() => {
    const present = new Set(events.filter(e => city === ALL || e.restaurant?.city?.slug === city).map(e => e.event_type));
    return EVENT_TYPES.filter(t => present.has(t.value));
  }, [events, city]);

  const filtered = useMemo(
    () => events.filter(e => (city === ALL || e.restaurant?.city?.slug === city) && (type === ALL || e.event_type === type)),
    [events, city, type],
  );

  const setFilter = (key: 'stad' | 'type', value: string) => {
    const next = new URLSearchParams(params);
    if (value === ALL) next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  };

  const cityName = cities.find(([slug]) => slug === city)?.[1];
  const heading = cityName ? `Specials en evenementen in ${cityName}` : 'Specials en evenementen';

  return (
    <Layout>
      <SEOHead
        title={`${heading} | Dishloopr`}
        description="Ladies nights, onbeperkt steak, pubquizzen en wijnproeverijen bij restaurants bij jou in de buurt. Bekijk alle specials per stad."
        keywords={['restaurant specials', 'evenementen', 'ladies night', 'pubquiz', 'wijnproeverij', 'onbeperkt eten']}
        canonical="https://dishloopr.com/evenementen"
        structuredData={{
          '@context': 'https://schema.org',
          '@graph': [
            createBreadcrumbSchema([
              { name: 'Home', url: 'https://dishloopr.com' },
              { name: 'Evenementen', url: 'https://dishloopr.com/evenementen' },
            ]),
            ...(events.length > 0 ? [{
              '@type': 'ItemList',
              itemListElement: events.slice(0, 20).map((e, i) => ({
                '@type': 'ListItem', position: i + 1, name: e.title, url: `https://dishloopr.com/evenementen/${e.id}`,
              })),
            }] : []),
          ],
        }}
      />

      <div className="container py-8 md:py-12">
        <header className="mb-8 max-w-2xl">
          <h1 className="flex items-center gap-3 font-display text-3xl font-bold md:text-4xl">
            <PartyPopper className="h-8 w-8 shrink-0 text-primary" />
            {heading}
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Van ladies night tot pubquiz en van onbeperkt steak tot wijnproeverij. Zo zie je in één keer wat er bij restaurants te doen is.
          </p>
        </header>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <Select value={city} onValueChange={v => setFilter('stad', v)}>
            <SelectTrigger className="min-h-11 w-full sm:w-60" aria-label="Filter op stad">
              <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle steden</SelectItem>
              {cities.map(([slug, name]) => <SelectItem key={slug} value={slug}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={v => setFilter('type', v)}>
            <SelectTrigger className="min-h-11 w-full sm:w-60" aria-label="Filter op soort">
              <Tags className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue>{type === ALL ? 'Alle soorten' : eventTypeLabel(type)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Alle soorten</SelectItem>
              {types.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="aspect-[4/3] rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarDays className="mx-auto mb-4 h-14 w-14 text-muted-foreground" />
            <h2 className="mb-2 font-display text-xl font-semibold">
              {cityName ? `Nog geen specials in ${cityName}` : 'Nog geen specials'}
            </h2>
            <p className="text-muted-foreground">Restaurants plaatsen hier hun acties en evenementen. Kom snel terug.</p>
            {(city !== ALL || type !== ALL) && (
              <Button variant="outline" className="mt-5 min-h-11" onClick={() => setParams({}, { replace: true })}>Toon alles</Button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((event, i) => <EventCard key={event.id} event={event} priority={i < 3} />)}
          </div>
        )}

        <aside className="mt-12 rounded-xl border bg-muted/40 p-6">
          <h2 className="font-display text-lg font-semibold">Heb je een restaurant?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Zet je eigen special of evenement op Dishloopr voor €5 per maand. Elke maand zie je hoe vaak het bekeken is.
          </p>
          <Button asChild variant="outline" className="mt-4 min-h-11"><Link to="/voor-restaurants/pakketten">Bekijk de pakketten</Link></Button>
        </aside>
      </div>
    </Layout>
  );
}
