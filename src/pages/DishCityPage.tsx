import { useMemo } from 'react';
import { useParams, Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronRight, MapPin, Search, Star } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead, createFAQSchema, createBreadcrumbSchema, createItemListSchema } from '@/components/seo/SEOHead';
import { DatabaseRestaurantCard } from '@/components/restaurant/DatabaseRestaurantCard';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useSeoLandingPage } from '@/hooks/useSeoLandingPage';
import { FACET_GROUPS, getFacet, matchesFacet } from '@/lib/dishCityFacets';
import NotFound from './NotFound';

export default function DishCityPage() {
  const { slug, facet: facetSlug } = useParams<{ slug: string; facet?: string }>();
  const location = useLocation();
  const { t } = useTranslation();
  const { page, restaurants, loading, error, redirectTo } = useSeoLandingPage(slug);

  const activeFacet = getFacet(facetSlug);
  const isFacetRoute = !!facetSlug;
  // Unknown facet on the /:facet route → 404.
  const unknownFacet = isFacetRoute && !activeFacet;

  // Client-side filter of the strict canonical-matched restaurants.
  const visibleRestaurants = useMemo(() => {
    if (!activeFacet) return restaurants;
    return restaurants.filter(r => matchesFacet(r as any, activeFacet));
  }, [restaurants, activeFacet]);

  // Count per facet (across meal + ambience + price) for chip rendering.
  const facetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const group of FACET_GROUPS) {
      for (const f of group.facets) {
        let n = 0;
        for (const r of restaurants) if (matchesFacet(r as any, f)) n++;
        counts[f.slug] = n;
      }
    }
    return counts;
  }, [restaurants]);

  const hasQueryParams = location.search && location.search.length > 1;
  // Empty facet results OR non-whitelisted query params → noindex, canonical to base.
  const noindex = unknownFacet || (isFacetRoute && visibleRestaurants.length === 0) || (isFacetRoute && hasQueryParams);

  if (redirectTo) {
    return <Navigate to={redirectTo} replace />;
  }

  if (error === 'Page not found') {
    return <NotFound />;
  }

  if (unknownFacet && !loading) {
    return <NotFound />;
  }

  if (loading) {
    return (
      <Layout>
        <div className="container px-4 md:px-6 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  if (!page) {
    return <NotFound />;
  }

  const breadcrumbs = [
    { name: 'Home', url: 'https://dishloopr.com/' },
    { name: 'Eten', url: 'https://dishloopr.com/eten' },
    ...(page.city ? [{ name: page.city.name, url: `https://dishloopr.com/search?city=${page.city.id}` }] : []),
    { name: page.h1_title, url: `https://dishloopr.com/eten/${page.slug}` },
    ...(activeFacet ? [{ name: activeFacet.label, url: `https://dishloopr.com/eten/${page.slug}/${activeFacet.slug}` }] : []),
  ];

  const restaurantItemList = visibleRestaurants.length > 0 ? createItemListSchema(
    visibleRestaurants.map((r, i) => ({
      name: r.name,
      url: `https://dishloopr.com/restaurant/${r.slug}`,
      position: i + 1,
    }))
  ) : null;

  const structuredData = [
    createBreadcrumbSchema(breadcrumbs),
    ...((!activeFacet && page.faq_content.length > 0)
      ? [createFAQSchema(page.faq_content.map(faq => ({ question: faq.question, answer: faq.answer })))]
      : []
    ),
    ...(restaurantItemList ? [restaurantItemList] : []),
  ];

  const baseUrl = `https://dishloopr.com/eten/${page.slug}`;
  const facetTitle = activeFacet && page.dish && page.city
    ? `${page.dish.name} ${activeFacet.titleModifier} in ${page.city.name}`
    : page.h1_title;
  const facetMetaTitle = activeFacet && page.dish && page.city
    ? `${page.dish.name} ${activeFacet.titleModifier} in ${page.city.name} | Dishloopr`
    : page.meta_title;
  const facetMetaDescription = activeFacet && page.dish && page.city
    ? `Ontdek restaurants voor ${page.dish.name.toLowerCase()} ${activeFacet.titleModifier} in ${page.city.name}. Vergelijk, filter en vind jouw favoriet.`
    : page.meta_description;
  const canonical = activeFacet && !noindex
    ? `${baseUrl}/${activeFacet.slug}`
    : (page.canonical_url || baseUrl);

  return (
    <Layout>
      <SEOHead
        title={facetMetaTitle}
        description={facetMetaDescription}
        keywords={page.keywords || undefined}
        canonical={canonical}
        noindex={noindex}
        structuredData={structuredData}
      />

      {/* Breadcrumb */}
      <div className="container px-4 md:px-6 pt-4">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground overflow-x-auto whitespace-nowrap pb-2">
          <Link to="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
          <Link to="/eten" className="hover:text-foreground transition-colors">
            Eten
          </Link>
          {page.city && (
            <>
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
              <Link 
                to={`/search?city=${page.city.id}`} 
                className="hover:text-foreground transition-colors"
              >
                {page.city.name}
              </Link>
            </>
          )}
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
          {activeFacet ? (
            <>
              <Link
                to={`/eten/${page.slug}`}
                className="hover:text-foreground transition-colors"
              >
                {page.dish?.name}
              </Link>
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
              <span className="text-foreground font-medium truncate">
                {activeFacet.label}
              </span>
            </>
          ) : (
            <span className="text-foreground font-medium truncate">
              {page.dish?.name}
            </span>
          )}
        </nav>
      </div>

      {/* Hero Section */}
      <section className="container px-4 md:px-6 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl"
        >
          <div className="flex items-center gap-2 mb-4">
            {page.city && (
              <Badge variant="outline" className="gap-1">
                <MapPin className="h-3 w-3" />
                {page.city.name}
              </Badge>
            )}
            {page.dish && (
              <Badge variant="secondary">
                {page.dish.name}
              </Badge>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            {facetTitle}
          </h1>

          {!activeFacet && page.intro_text && (
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-6">
              {page.intro_text}
            </p>
          )}

          {!activeFacet && page.extended_description && (
            <p className="text-muted-foreground leading-relaxed mb-8">
              {page.extended_description}
            </p>
          )}

          {/* Quick Search CTA */}
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={`/search?dish=${page.dish?.name || ''}&city=${page.city?.id || ''}`}>
                <Search className="h-4 w-4 mr-2" />
                Zoek restaurants
              </Link>
            </Button>
            {page.city && (
              <Button variant="outline" size="lg" asChild>
                <Link to={`/search?city=${page.city.id}`}>
                  Alles in {page.city.name}
                </Link>
              </Button>
            )}
          </div>
        </motion.div>
      </section>

      {/* Facet filter chips — indexable filter URLs (programmatic SEO) */}
      <section className="container px-4 md:px-6 pb-2">
        {FACET_GROUPS.map(group => {
          const items = group.facets.filter(f => (facetCounts[f.slug] || 0) > 0 || activeFacet?.slug === f.slug);
          if (items.length === 0) return null;
          return (
            <div key={group.kind} className="mb-3">
              <p className="text-sm text-muted-foreground mb-2">{group.heading}</p>
              <div className="flex flex-wrap gap-2">
                {activeFacet?.kind === group.kind && (
                  <Link
                    to={`/eten/${page.slug}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-border hover:bg-primary/10 transition-colors"
                  >
                    Alle
                  </Link>
                )}
                {items.map(f => {
                  const isActive = activeFacet?.slug === f.slug;
                  return (
                    <Link
                      key={f.slug}
                      to={`/eten/${page.slug}/${f.slug}`}
                      aria-current={isActive ? 'page' : undefined}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-primary/10'
                      }`}
                    >
                      {f.label}
                      <span className="text-xs opacity-70">({facetCounts[f.slug] || 0})</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* Restaurant Results */}
      <section className="container px-4 md:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            {visibleRestaurants.length > 0
              ? `${visibleRestaurants.length} restaurants gevonden`
              : 'Aanbevolen restaurants'
            }
          </h2>
          {visibleRestaurants.length > 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              Gesorteerd op rating
            </div>
          )}
        </div>

        {visibleRestaurants.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {visibleRestaurants.map((restaurant, index) => (
              <motion.div
                key={restaurant.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.3) }}
              >
                <DatabaseRestaurantCard restaurant={restaurant as any} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-xl">
            <p className="text-muted-foreground mb-4">
              {activeFacet
                ? `Nog geen restaurants gevonden voor ${page.dish?.name} ${activeFacet.titleModifier} in ${page.city?.name || 'Nederland'}.`
                : 'Nog geen restaurants gevonden voor deze combinatie.'}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {activeFacet && (
                <Button asChild variant="outline">
                  <Link to={`/eten/${page.slug}`}>
                    Terug naar {page.dish?.name} in {page.city?.name}
                  </Link>
                </Button>
              )}
              <Button asChild>
                <Link to={`/search?city=${page.city?.id || ''}`}>
                  Bekijk alle restaurants in {page.city?.name || 'Nederland'}
                </Link>
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* FAQ Section */}
      {!activeFacet && page.faq_content.length > 0 && (
        <section className="container px-4 md:px-6 py-8 md:py-12">
          <h2 className="text-2xl font-bold mb-6">
            Veelgestelde vragen over {page.dish?.name?.toLowerCase()} in {page.city?.name}
          </h2>
          
          <Accordion type="single" collapsible className="max-w-3xl">
            {page.faq_content.map((faq, index) => (
              <AccordionItem key={index} value={`faq-${index}`}>
                <AccordionTrigger className="text-left">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      )}

      {/* Related Links (for internal linking / SEO) */}
      <section className="container px-4 md:px-6 py-8 border-t">
        <h3 className="font-semibold mb-4">Ontdek meer</h3>
        <div className="flex flex-wrap gap-2">
          {page.city && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/search?city=${page.city.id}`}>
                Alle restaurants in {page.city.name}
              </Link>
            </Button>
          )}
          {page.dish && (
            <Button variant="ghost" size="sm" asChild>
              <Link to={`/search?dish=${page.dish.name}`}>
                {page.dish.name} in heel Nederland
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" asChild>
            <Link to="/collections">
              Bekijk collecties
            </Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
