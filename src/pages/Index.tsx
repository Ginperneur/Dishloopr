import { useTranslation } from 'react-i18next';
import { tTaxonomy } from '@/lib/i18n/taxonomy';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { BookmarkCheck, X, Bell, BellOff } from 'lucide-react';
import { SearchBar } from '@/components/search/SearchBar';
import { Layout } from '@/components/layout/Layout';
import { TrendingDishes } from '@/components/home/TrendingDishes';
import { HomeCityBlocks } from '@/components/home/HomeCityBlocks';
import { RecentlyViewed } from '@/components/home/RecentlyViewed';
import { SurpriseMe } from '@/components/ai/SurpriseMe';
import { SEOHead, createWebsiteSchema } from '@/components/seo/SEOHead';
import { useTrendingDishes } from '@/hooks/useTrendingDishes';
import { useSavedSearches } from '@/hooks/useSavedSearches';
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Below-the-fold sections load as separate chunks
const PersonalizedRecommendations = lazy(() => import('@/components/ai/PersonalizedRecommendations').then((m) => ({ default: m.PersonalizedRecommendations })));
import { toast } from 'sonner';

// Popular cuisines to show as quick links in hero.
// `value` is the lowercase DB/search value (unchanged); `dbLabel` is the capitalized
// Dutch form that CUISINE_I18N_KEYS (src/lib/i18n/taxonomy.ts) maps to a translation key.
const POPULAR_CUISINES = [
  { dbLabel: null, value: 'all you can eat', i18nKey: 'filters.allYouCanEat' },
  { dbLabel: 'Surinaams', value: 'surinaams' },
  { dbLabel: 'Sushi', value: 'sushi' },
  { dbLabel: 'Italiaans', value: 'italiaans' },
  { dbLabel: 'Indiaas', value: 'indiaas' },
  { dbLabel: 'Mexicaans', value: 'mexicaans' },
  { dbLabel: 'Thais', value: 'thais' },
  { dbLabel: 'Grieks', value: 'grieks' },
] as const;

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dishes: trendingDishes, loading: dishesLoading } = useTrendingDishes();
  const { saved: savedSearches, remove: removeSavedSearch, setAlerts: setSavedAlerts } = useSavedSearches();

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
            initial={false}
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

          <SearchBar variant="hero" followVisitorCity />

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
                    {cuisine.dbLabel ? tTaxonomy(t, 'cuisine', cuisine.dbLabel) : 'i18nKey' in cuisine ? t(cuisine.i18nKey) : cuisine.value}
                  </button>
                ))}
              </div>
            </div>

            {/* Desktop: centered wrapping chips */}
            <div className="hidden sm:flex flex-wrap justify-center gap-2">
              <span className="text-sm text-muted-foreground mr-1 self-center">
                {t('home.popular', 'Populair')}:
              </span>
              {POPULAR_CUISINES.slice(0, 6).map((cuisine) => (
                <button
                  key={cuisine.value}
                  onClick={() => handleCuisineClick(cuisine.value)}
                  className="px-3 py-1.5 text-sm font-medium rounded-full bg-card border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors touch-manipulation min-h-[36px] flex items-center"
                >
                  {cuisine.dbLabel ? tTaxonomy(t, 'cuisine', cuisine.dbLabel) : 'i18nKey' in cuisine ? t(cuisine.i18nKey) : cuisine.value}
                </button>
              ))}
            </div>
          </motion.div>
          
          {/* AI Surprise Button. "Bij mij in de buurt" moved into the city picker as "Mijn locatie". */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
            className="flex flex-wrap justify-center items-center gap-2 mt-3 md:mt-5"
          >
            <SurpriseMe />
          </motion.div>
        </div>
      </section>

      {/* Recently Viewed: returning visitors only, a slim strip above the city */}
      <RecentlyViewed />

      {/* One city drives everything below: chosen in the search bar (or with the tiles / location).
          No city: "In welke stad zoek je?" + "Uitgelicht in Nederland". A city: "Eten in <stad>" +
          "Uitgelicht in <stad>" on the same place, events, popular pages, the editors' picks. */}
      <HomeCityBlocks />

      {/* Trending Dishes — shown before personalized picks */}
      <div id="trending" className="scroll-mt-24">
        {dishesLoading ? (
          <section className="py-6 md:py-8" aria-hidden="true">
            <div className="container px-4 md:px-6">
              <Skeleton className="h-7 w-48 mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            </div>
          </section>
        ) : (
          <TrendingDishes dishes={trendingDishes} cityName="Nederland" />
        )}
      </div>

      {/* Personalized Recommendations for logged-in users */}
      <Suspense fallback={null}><PersonalizedRecommendations /></Suspense>

    </Layout>
  );
};

export default Index;
