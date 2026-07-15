import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Navigation, Loader2, BookmarkCheck, X, Bell, BellOff } from 'lucide-react';
import { SearchBar } from '@/components/search/SearchBar';
import { Layout } from '@/components/layout/Layout';
import { TrendingDishes } from '@/components/home/TrendingDishes';
import { FeaturedRestaurants } from '@/components/home/FeaturedRestaurants';
import { UpcomingEvents } from '@/components/home/UpcomingEvents';
import { SocialProof } from '@/components/home/SocialProof';
import { RecentlyViewed } from '@/components/home/RecentlyViewed';
import { SeasonalSuggestions } from '@/components/home/SeasonalSuggestions';
import { ExploreCities } from '@/components/home/ExploreCities';
import { HowItWorks } from '@/components/home/HowItWorks';
import { DatabaseRestaurantCard } from '@/components/restaurant/DatabaseRestaurantCard';
import { SurpriseMe } from '@/components/ai/SurpriseMe';
import { PersonalizedRecommendations } from '@/components/ai/PersonalizedRecommendations';
import { FeaturedCollections } from '@/components/collections/CollectionsGrid';
import { SEOHead, createWebsiteSchema } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useTrendingDishes } from '@/hooks/useTrendingDishes';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useSavedSearches } from '@/hooks/useSavedSearches';
import { useContentAvailability } from '@/hooks/useContentAvailability';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Popular cuisines to show as quick links in hero
const POPULAR_CUISINES = [
  { label: 'All you can eat', value: 'all you can eat' },
  { label: 'Surinaams', value: 'surinaams' },
  { label: 'Sushi', value: 'sushi' },
  { label: 'Italiaans', value: 'italiaans' },
  { label: 'Indiaas', value: 'indiaas' },
  { label: 'Mexicaans', value: 'mexicaans' },
  { label: 'Thais', value: 'thais' },
  { label: 'Grieks', value: 'grieks' },
];

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dishes: trendingDishes, loading: dishesLoading } = useTrendingDishes();
  const { latitude, longitude, loading: geoLoading, error: geoError, requestLocation, clearLocation } = useGeolocation();
  const { saved: savedSearches, remove: removeSavedSearch, setAlerts: setSavedAlerts } = useSavedSearches();
  const { hasCollections, hasEvents } = useContentAvailability();
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [nearbyRequested, setNearbyRequested] = useState(false);
  const [feedTab, setFeedTab] = useState<'foryou' | 'nearby'>('foryou');

  // Show "How it works" only for first-time visitors
  useEffect(() => {
    try {
      const seen = localStorage.getItem('dl_seen_how_it_works');
      if (!seen) {
        setShowHowItWorks(true);
        localStorage.setItem('dl_seen_how_it_works', '1');
      }
    } catch {
      setShowHowItWorks(true);
    }
  }, []);

  // Navigate to map view ONLY when user explicitly requested nearby search.
  // This prevents an infinite redirect loop when geolocation is cached and the
  // user navigates back to the homepage.
  useEffect(() => {
    if (nearbyRequested && latitude && longitude) {
      setNearbyRequested(false);
      const lat = latitude.toFixed(5);
      const lng = longitude.toFixed(5);
      clearLocation();
      navigate(`/search?view=map&near=${lat},${lng}`);
    }
  }, [nearbyRequested, latitude, longitude, navigate, clearLocation]);

  const handleNearbyClick = () => {
    setNearbyRequested(true);
    requestLocation();
  };

  useEffect(() => {
    if (geoError) toast.error(geoError);
  }, [geoError]);

  const handleCuisineClick = (cuisine: string) => {
    // Some items are dishes (sushi), others are cuisines (italiaans)
    const cuisineTerms = ['surinaams', 'italiaans', 'indiaas', 'mexicaans', 'thais', 'grieks'];
    if (cuisineTerms.includes(cuisine.toLowerCase())) {
      navigate(`/search?cuisine=${encodeURIComponent(cuisine)}`);
    } else {
      navigate(`/search?dish=${encodeURIComponent(cuisine)}`);
    }
  };

  return (
    <Layout>
      <SEOHead
        title="Dishloopr - Vind restaurants op gerecht | NL"
        description="Zoek restaurants op basis van het gerecht waar je zin in hebt. Filter op stad, sfeer en prijs. Ontdek de lekkerste plekken in Nederland."
        keywords={['restaurants', 'gerechten', 'eten', 'Nederland', 'reviews', 'uit eten', 'zoek op gerecht']}
        structuredData={createWebsiteSchema()}
        canonical="https://dishloopr.com"
      />
      {/* Hero Section */}
      <section className="relative py-6 sm:py-8 md:py-10 lg:py-12 pb-6 sm:pb-8 md:pb-6 lg:pb-8 z-10">
        {/* Background gradient */}
        <div 
          className="absolute inset-0 -z-10"
          style={{ 
            background: 'linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--muted) / 0.3) 100%)' 
          }}
        />
        
        <div className="container relative px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center mb-5 md:mb-10"
          >
            <h1 className="text-2xl sm:text-3xl md:text-5xl lg:text-6xl font-extrabold mb-2 md:mb-3 leading-tight font-display">
              {t('hero.title')}
              <br />
              <span className="text-gradient">{t('hero.titleAccent')}</span>
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground max-w-xl mx-auto px-2">
              {t('hero.subtitle')}
            </p>
          </motion.div>

          <SearchBar variant="hero" />

          {/* Saved searches — quick re-entry for returning users (P4 retention) */}
          {savedSearches.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="mt-3 max-w-3xl mx-auto"
              aria-label={t('home.ariaSavedSearches', 'Opgeslagen zoekopdrachten')}
            >
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <BookmarkCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span className="text-xs font-medium text-muted-foreground">
                  {t('home.savedSearches', 'Jouw opgeslagen zoekopdrachten')}
                </span>
              </div>
              <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
                {savedSearches.map((s) => (
                  <span
                    key={s.id}
                    className="shrink-0 snap-start inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20"
                  >
                    <Link
                      to={s.url}
                      className="min-h-[28px] flex items-center"
                    >
                      {s.label}
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        const enabled = !s.alertsEnabled;
                        const ok = await setSavedAlerts(s.id, enabled);
                        if (enabled && !ok) {
                          toast.error(t('home.alertsBlocked', 'Notificaties geblokkeerd in de browser'));
                        } else if (enabled) {
                          toast.success(t('home.alertsOn', 'Je krijgt een melding bij nieuwe matches'));
                        } else {
                          toast(t('home.alertsOff', 'Meldingen uitgezet'));
                        }
                      }}
                      className="p-1 rounded-full hover:bg-primary/20 transition-colors"
                      aria-label={s.alertsEnabled ? `Meldingen uit voor ${s.label}` : `Meldingen aan voor ${s.label}`}
                      aria-pressed={!!s.alertsEnabled}
                    >
                      {s.alertsEnabled ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3 opacity-60" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSavedSearch(s.id)}
                      className="p-1 rounded-full hover:bg-primary/20 transition-colors"
                      aria-label={`Verwijder ${s.label}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </motion.div>
          )}

          {/* Popular Cuisines — horizontal scroll on mobile, wrap on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="mt-3 md:mt-5 max-w-3xl mx-auto"
          >
            {/* Mobile: edge-to-edge horizontal scroll */}
            <div className="sm:hidden -mx-4 px-4">
              <div
                role="region"
                aria-roledescription="carousel"
                aria-label={t('home.popularCuisines', 'Populaire keukens')}
                className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1"
              >
                {POPULAR_CUISINES.map((cuisine) => (
                  <button
                    key={cuisine.value}
                    onClick={() => handleCuisineClick(cuisine.value)}
                    className="shrink-0 snap-start px-3.5 py-2 text-xs font-medium rounded-full bg-card border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors touch-manipulation min-h-[36px] flex items-center"
                  >
                    {cuisine.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop: centered wrapping chips */}
            <div className="hidden sm:flex flex-wrap justify-center gap-2">
              <span className="text-sm text-muted-foreground mr-1 self-center">
                {t('home.popular', 'Populair')}:
              </span>
              {POPULAR_CUISINES.map((cuisine) => (
                <button
                  key={cuisine.value}
                  onClick={() => handleCuisineClick(cuisine.value)}
                  className="px-3 py-1.5 text-sm font-medium rounded-full bg-card border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors touch-manipulation min-h-[36px] flex items-center"
                >
                  {cuisine.label}
                </button>
              ))}
            </div>
          </motion.div>
          
          {/* AI Surprise Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="flex flex-wrap justify-center items-center gap-2 mt-3 md:mt-5"
          >
            <SurpriseMe />
            <button
              type="button"
              onClick={handleNearbyClick}
              disabled={geoLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-border bg-card hover:bg-muted transition-colors min-h-[36px] disabled:opacity-60"
              aria-label={t('home.ariaNearby', 'Zoek restaurants in mijn buurt')}
            >
              {geoLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4 text-primary" />
              )}
              <span>{t('home.nearby', 'Bij mij in de buurt')}</span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* Recently Viewed */}
      <RecentlyViewed />

      {/* Featured Restaurants — prominent paid-placement slot (revenue driver) */}
      <FeaturedRestaurants />

      {/* Featured Collections — prominent editorial/paid slot */}
      {hasCollections && (
        <section
          id="collections"
          className="py-6 md:py-8 scroll-mt-24"
          aria-labelledby="featured-collections-heading"
        >
          <div className="container px-4 md:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-end justify-between mb-4 md:mb-6 gap-3"
            >
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
                  ✨ {t('home.curatedLabel', 'Samengesteld')}
                </div>
                <h2 id="featured-collections-heading" className="text-xl sm:text-2xl md:text-3xl font-bold">
                  {t('home.ourCollections')}
                </h2>
              </div>
              <Button variant="ghost" size="sm" asChild className="text-sm shrink-0">
                <Link to="/collections" className="flex items-center gap-1 md:gap-2">
                  {t('home.viewAll')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
            <FeaturedCollections />
          </div>
        </section>
      )}

      {/* Feed tab switcher: For You vs Nearby (P2 hierarchy) */}
      <section
        aria-label={t('home.discoverContent', 'Aanbevolen content')}
        className="container px-4 md:px-6 pt-4 sm:pt-6"
      >
        <Tabs
          value={feedTab}
          onValueChange={(v) => {
            if (v === 'nearby') {
              handleNearbyClick();
            } else {
              setFeedTab('foryou');
            }
          }}
        >
          <TabsList className="w-full max-w-md mx-auto grid grid-cols-2">
            <TabsTrigger value="foryou" aria-label={t('home.forYou', 'Voor jou')}>
              {t('home.forYou', 'Voor jou')}
            </TabsTrigger>
            <TabsTrigger value="nearby" aria-label={t('home.nearbyTab', 'In de buurt')}>
              {geoLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Navigation className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t('home.nearbyTab', 'In de buurt')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </section>

      {/* Mobile quick-jump strip — reduces perceived page length by giving
          immediate access to key sections (P2 content hierarchy). */}
      <nav
        aria-label={t('home.quickNav', 'Snelle navigatie')}
        className="sm:hidden sticky top-12 z-30 bg-background/95 backdrop-blur border-b border-border"
      >
        <div className="-mx-0 px-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory py-2">
            {([
              { label: 'Uitgelicht', href: '#featured', show: true },
              { label: 'Trending', href: '#trending', show: true },
              { label: 'Collecties', href: '#collections', show: hasCollections },
              { label: 'Steden', href: '#cities', show: true },
              { label: 'Events', href: '#events', show: hasEvents },
            ].filter((i) => i.show)).map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="shrink-0 snap-start px-3 py-1.5 text-xs font-medium rounded-full bg-card border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors min-h-[32px] flex items-center"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      {/* Always-on discovery block — guarantees the page has meaningful content
          even when featured/trending sections are empty (P0 empty-state fix). */}
      <div id="cities">
        <ExploreCities />
      </div>

      {/* Social Proof Stats */}
      <SocialProof />

      {/* How it works — only for first-time visitors */}
      {showHowItWorks && <HowItWorks />}

      {/* Trending Dishes — shown before personalized picks */}
      <div id="trending" className="scroll-mt-24">
        <TrendingDishes dishes={trendingDishes} />
      </div>

      {/* Personalized Recommendations for logged-in users */}
      <PersonalizedRecommendations />

      {/* Upcoming Events */}
      <div id="events" className="scroll-mt-24">
        <UpcomingEvents />
      </div>

      {/* Seasonal Suggestions */}
      <SeasonalSuggestions />
    </Layout>
  );
};

export default Index;
