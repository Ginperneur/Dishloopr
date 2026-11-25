import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Award, ChevronLeft, MapPin, Star, X } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CityCombobox } from '@/components/common/CityCombobox';
import { SEOHead, createBreadcrumbSchema, createItemListSchema } from '@/components/seo/SEOHead';
import { useCollection, useCollectionCities, useCollectionList, useCollectionPaidPlacements, isAutoCollection, type CollectionListItem } from '@/hooks/useCollections';
import { PaidLabel, WhyPaidLink } from '@/components/paid/PaidLabel';
import { localizedField } from '@/lib/i18n/localizedField';
import { useTranslation } from 'react-i18next';
import { RatingSummary } from '@/components/restaurant/RatingSummary';
import { useOwnReviewStats } from '@/hooks/useOwnReviewStats';
import { optimizedImage, imgLoadingProps } from '@/lib/imageUrl';
import { MoodImage } from '@/components/restaurant/MoodImage';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80';
const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);

// Old city-bound collections that became national ones, with the city they were about.
const RENAMED: Record<string, { slug: string; stad: string }> = {
  'beste-ramen-amsterdam': { slug: 'beste-ramen', stad: 'amsterdam' },
};

function RestaurantCard({ item, index, reviewNoun }: { item: CollectionListItem; index: number; reviewNoun: string }) {
  const ownStats = useOwnReviewStats(item.restaurant_id);
  return (
    <motion.div
      data-restaurant-id={item.restaurant_id}
      data-position={index + 1}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.04 }}
    >
      <Link to={`/restaurant/${item.slug}`} state={{ metricContext: 'collectie' }}>
        <Card className="group overflow-hidden transition-all duration-300 hover:shadow-lg">
          <div className="flex flex-col sm:flex-row">
            <div className="relative h-44 w-full flex-shrink-0 overflow-hidden sm:h-auto sm:w-48">
              {item.images?.[0] ? (
                <img
                  src={optimizedImage(item.images[0], { width: 400 })}
                  alt={item.name}
                  width={400}
                  height={300}
                  {...imgLoadingProps(false)}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                // No own photo: a labelled sfeerbeeld instead of a stock interior.
                <MoodImage seed={item.restaurant_id} name={item.name} cuisines={item.cuisines} labelAt="bottom-right" />
              )}
              <div className="absolute bottom-2 left-2 flex h-8 min-w-8 items-center justify-center rounded-full bg-primary px-2 text-sm font-bold text-primary-foreground">
                #{index + 1}
              </div>
            </div>

            <CardContent className="flex-1 p-4 md:p-6">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-xl font-bold transition-colors group-hover:text-primary">{item.name}</h3>
                <RatingSummary
                  ownReviewCount={ownStats?.count}
                  ownAverage={ownStats?.average}
                />
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                {item.address && <span>{item.address}</span>}
                {item.city_name && !item.address?.includes(item.city_name) && <span>· {item.city_name}</span>}
              </div>

              {item.dish_name && (
                <p className="mb-3 text-sm">
                  <span className="font-medium">Op de kaart:</span>{' '}
                  <span className="capitalize">{item.dish_name.toLowerCase()}</span>
                  {item.dish_price != null && <span className="font-semibold tabular-nums"> {euro(item.dish_price)}</span>}
                </p>
              )}

              <p className="mb-3 text-sm">
                {item.review_count > 0 ? (
                  <>
                    <Star className="mr-1 inline h-4 w-4 fill-rating text-rating" aria-hidden="true" />
                    <strong>{(item.review_avg ?? 0).toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
                    <span className="text-muted-foreground"> uit {item.review_count} {reviewNoun}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Nog geen {reviewNoun}</span>
                )}
              </p>

              {item.is_pick && (
                <p className="mb-3 flex items-start gap-1.5 text-sm text-muted-foreground">
                  <Award className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span><span className="font-medium text-foreground">Keuze van de redactie</span>{item.pick_reason ? `: ${item.pick_reason}` : ''}</span>
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {item.price_level ? <Badge variant="secondary">{'€'.repeat(item.price_level)}</Badge> : null}
                {item.cuisines?.slice(0, 3).map(cuisine => (
                  <Badge key={cuisine} variant="outline" className="capitalize">{cuisine}</Badge>
                ))}
                {item.ambience_tags?.slice(0, 2).map(tag => (
                  <Badge key={tag} variant="outline" className="capitalize">{tag}</Badge>
                ))}
              </div>
            </CardContent>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

export default function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const [params, setParams] = useSearchParams();
  const citySlug = params.get('stad');
  const renamed = slug ? RENAMED[slug] : undefined;
  const { collection, loading } = useCollection(renamed ? undefined : slug);
  const cities = useCollectionCities(renamed ? undefined : slug);
  const list = useCollectionList(renamed ? undefined : slug, citySlug);
  const paid = useCollectionPaidPlacements(renamed ? undefined : slug, citySlug);
  const { i18n } = useTranslation();

  if (renamed) return <Navigate to={`/collection/${renamed.slug}?stad=${renamed.stad}`} replace />;

  if (loading) {
    return (
      <Layout>
        <div className="h-64 animate-pulse bg-muted md:h-80" />
        <div className="container py-8">
          <Skeleton className="mb-4 h-10 w-64" />
          <Skeleton className="mb-8 h-6 w-96 max-w-full" />
          <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-48" />)}</div>
        </div>
      </Layout>
    );
  }

  if (!collection) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="mb-4 text-2xl font-bold">Collectie niet gevonden</h1>
          <Button asChild><Link to="/collections">Bekijk alle collecties</Link></Button>
        </div>
      </Layout>
    );
  }

  const auto = isAutoCollection(collection);
  const title = localizedField(collection.title_i18n, collection.title, i18n.language);
  const subtitle = localizedField(collection.subtitle_i18n, collection.subtitle, i18n.language);
  const description = localizedField(collection.description_i18n, collection.description, i18n.language);
  const cityList = cities.data ?? [];
  const city = citySlug ? cityList.find(c => c.city_slug === citySlug) : undefined;
  const cityName = city?.city_name ?? collection.city?.name ?? null;
  const scopeTitle = citySlug && city ? `${title} in ${city.city_name}` : title;
  const restaurants = list.data ?? [];
  // "Beste ramen" → "reviews van ramen"; other collections count reviews of the dishes or the restaurant.
  const dishSubject = collection.title.replace(/^Beste /, '');
  const reviewNoun = dishSubject !== collection.title
    ? `reviews van ${/^[A-Z][a-z]+ [a-z]/.test(dishSubject) ? dishSubject : dishSubject.toLowerCase()}`
    : 'reviews';
  const total = restaurants[0]?.total ?? 0;
  const setCity = (next: string | null) => {
    const p = new URLSearchParams(params);
    if (next) p.set('stad', next); else p.delete('stad');
    setParams(p, { replace: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const base = `https://dishloopr.com/collection/${collection.slug}`;
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: 'https://dishloopr.com' },
    { name: 'Collecties', url: 'https://dishloopr.com/collections' },
    { name: title, url: base },
    ...(city ? [{ name: city.city_name, url: `${base}?stad=${city.city_slug}` }] : []),
  ]);
  const itemListSchema = createItemListSchema(
    restaurants.slice(0, 20).map((item, index) => ({
      name: item.name,
      url: `https://dishloopr.com/restaurant/${item.slug}`,
      image: item.images?.[0] ?? undefined,
      position: index + 1,
    })),
  );

  return (
    <Layout>
      <SEOHead
        title={city ? `${scopeTitle} | Dishloopr` : collection.seo_title || `${title} | Dishloopr`}
        description={city
          ? `De best beoordeelde restaurants voor ${title.replace(/^Beste /, '').toLowerCase()} in ${city.city_name}, met prijzen van de kaart.`
          : collection.seo_description || description || `Ontdek de beste restaurants in onze ${title} collectie.`}
        ogType="article"
        ogImage={collection.cover_image || collection.auto_cover || undefined}
        canonical={city ? `${base}?stad=${city.city_slug}` : base}
        keywords={[title, cityName || 'Nederland', collection.dish?.name || '', collection.cuisine || '', 'restaurants', 'eten'].filter(Boolean)}
        structuredData={{ '@context': 'https://schema.org', '@graph': [breadcrumbSchema, itemListSchema] }}
      />

      <div className="relative h-56 overflow-hidden md:h-72">
        <img
          src={optimizedImage(collection.cover_image || collection.auto_cover || FALLBACK_IMAGE, { width: 1200 })}
          alt=""
          width={1200}
          height={320}
          {...imgLoadingProps(true)}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <Link to="/collections" aria-label="Terug naar alle collecties"
          className="absolute left-4 top-4 rounded-full bg-background/80 p-2 backdrop-blur transition-colors hover:bg-background">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="absolute bottom-0 left-0 right-0 p-5 md:p-8">
          <div className="container">
            <Badge className="mb-3" variant="secondary">
              <MapPin className="mr-1 h-3 w-3" aria-hidden="true" />
              {cityName ?? 'Heel Nederland'}
            </Badge>
            <h1 className="mb-2 text-3xl font-bold md:text-5xl">{scopeTitle}</h1>
            {subtitle && <p className="text-lg text-muted-foreground md:text-xl">{subtitle}</p>}
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl space-y-2">
            {description && <p className="text-lg text-muted-foreground">{description}</p>}
            {!list.isPending && total > 0 && (
              <p className="text-sm text-muted-foreground">
                {total} {total === 1 ? 'restaurant' : 'restaurants'} {city ? `in ${city.city_name}` : 'in Nederland'}
                {auto && total > restaurants.length ? `, de beste ${restaurants.length} op een rij` : ''}.
              </p>
            )}
            {auto && (
              <details className="rounded-lg border px-4 py-2 text-sm">
                <summary className="min-h-9 cursor-pointer py-1 font-medium">Zo werkt deze lijst</summary>
                <p className="pb-2 text-muted-foreground">
                  Een restaurant staat in deze lijst als het gerecht op de eigen kaart staat, met een prijs, en als we een foto,
                  minstens 10 gerechten met prijs en de openingstijden kennen. De volgorde bepalen gasten: hoe meer en hoe betere
                  reviews op het gerecht, hoe hoger. Vanaf 1 april 2027 telt een restaurant pas mee met minstens 10 reviews van
                  het gerecht. Betalen verandert deze volgorde niet.
                </p>
              </details>
            )}
          </div>
          {cityList.length > 1 && (
            <div className="order-first w-full shrink-0 space-y-2 md:order-none md:w-72">
              <label htmlFor="collection-city" className="text-sm font-medium">Kies je stad</label>
              <CityCombobox
                id="collection-city"
                cities={cityList.map(c => ({ id: c.city_slug, slug: c.city_slug, name: c.city_name }))}
                value={citySlug ?? ''}
                onChange={setCity}
                placeholder="Heel Nederland"
              />
              {citySlug && (
                <Button variant="ghost" size="sm" className="min-h-11 px-2" onClick={() => setCity(null)}>
                  <X className="mr-1 h-4 w-4" aria-hidden="true" /> Toon heel Nederland
                </Button>
              )}
            </div>
          )}
        </div>

        {auto && (paid.data?.length ?? 0) > 0 && (
          <section aria-labelledby="collection-paid" className="mb-8 space-y-3 rounded-2xl border border-accent bg-accent/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="collection-paid" className="flex flex-wrap items-center gap-2 text-base font-semibold">
                Uitgelicht in deze collectie <PaidLabel kind="uitgelicht" />
              </h2>
              <details className="text-sm">
                <summary className="min-h-9 cursor-pointer py-1 text-primary">Waarom zie ik dit?</summary>
                <p className="max-w-md pt-1 text-muted-foreground">
                  Deze restaurants betalen voor een plek bovenaan deze collectie. Ze hebben het gerecht echt op hun kaart, maar hun
                  plek is gekocht, niet verdiend met reviews. De ranglijst eronder is onafhankelijk.
                </p>
                <WhyPaidLink className="inline-block pt-1" />
              </details>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {paid.data!.map(p => (
                <Link key={p.restaurant_id} to={`/restaurant/${p.slug}`} state={{ metricContext: 'collectie' }}
                  className="flex gap-3 rounded-xl border bg-card p-3 transition-shadow hover:shadow-md">
                  <img src={optimizedImage(p.images?.[0] || FALLBACK_IMAGE, { width: 160 })} alt="" width={80} height={80}
                    {...imgLoadingProps(false)} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                  <span className="min-w-0 space-y-0.5">
                    <span className="block truncate font-semibold">{p.name}</span>
                    {p.city_name && <span className="block text-xs text-muted-foreground">{p.city_name}</span>}
                    {p.dish_name && (
                      <span className="block text-sm">
                        <span className="capitalize">{p.dish_name.toLowerCase()}</span>
                        {p.dish_price != null && <span className="font-semibold tabular-nums"> {euro(p.dish_price)}</span>}
                      </span>
                    )}
                    <span className="block text-xs text-muted-foreground">
                      {p.review_count > 0 ? `★ ${(p.review_avg ?? 0).toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} uit ${p.review_count} ${reviewNoun}` : `Nog geen ${reviewNoun}`}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="space-y-4">
          {list.isPending ? (
            [1, 2, 3].map(i => <Skeleton key={i} className="h-44" />)
          ) : list.isError ? (
            <p className="py-12 text-center text-muted-foreground">Deze lijst kon niet worden geladen. Probeer het later opnieuw.</p>
          ) : restaurants.length > 0 ? (
            restaurants.map((item, index) => <RestaurantCard key={item.restaurant_id} item={item} index={index} reviewNoun={reviewNoun} />)
          ) : (
            <div className="space-y-4 py-12 text-center">
              <p className="text-muted-foreground">
                {citySlug ? `In ${city?.city_name ?? 'deze stad'} staat nog geen restaurant in deze collectie. Bekijk heel Nederland of kies een andere stad.` : 'Nog geen restaurants in deze collectie.'}
              </p>
              {citySlug && <Button variant="outline" onClick={() => setCity(null)}>Toon heel Nederland</Button>}
            </div>
          )}
        </div>

        {auto && restaurants.length > 0 && (
          <p className="mt-6 text-sm text-muted-foreground">
            Mis je een restaurant? Het komt in de lijst zodra het aan de eisen voldoet. Heb je er gegeten? Schrijf een review over het gerecht, dan telt die mee.
          </p>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mt-12 text-center">
          <p className="mb-4 text-muted-foreground">Ontdek meer collecties of zoek zelf naar restaurants</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button variant="outline" asChild><Link to="/collections">Alle collecties</Link></Button>
            <Button asChild><Link to="/search">Zoek restaurants</Link></Button>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
