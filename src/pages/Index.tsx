import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { SearchBar } from '@/components/search/SearchBar';
import { Layout } from '@/components/layout/Layout';
import { TrendingDishes } from '@/components/home/TrendingDishes';
import { UpcomingEvents } from '@/components/home/UpcomingEvents';
import { DatabaseRestaurantCard } from '@/components/restaurant/DatabaseRestaurantCard';
import { SurpriseMe } from '@/components/ai/SurpriseMe';
import { PersonalizedRecommendations } from '@/components/ai/PersonalizedRecommendations';
import { FeaturedCollections } from '@/components/collections/CollectionsGrid';
import { SEOHead, createWebsiteSchema } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useFeaturedRestaurants } from '@/hooks/useFeaturedRestaurants';
import { useTrendingDishes } from '@/hooks/useTrendingDishes';

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
  const { restaurants: featuredRestaurants, loading: featuredLoading } = useFeaturedRestaurants(3);

  const handleCuisineClick = (cuisine: string) => {
    navigate(`/search?dish=${encodeURIComponent(cuisine)}`);
  };

  return (
    <Layout>
      <SEOHead
        title="Dishloopr - Ontdek de beste restaurants en gerechten in Nederland"
        description="Vind de lekkerste gerechten en restaurants bij jou in de buurt. Zoek op gerecht, bekijk reviews en ontdek nieuwe culinaire ervaringen."
        keywords={['restaurants', 'gerechten', 'eten', 'Nederland', 'reviews', 'culinair', 'uit eten']}
        structuredData={createWebsiteSchema()}
      />
      {/* Hero Section */}
      <section className="relative py-10 md:py-16 lg:py-20 pb-8 md:pb-12 lg:pb-16 overflow-hidden z-10">
        {/* Background gradient */}
        <div 
          className="absolute inset-0 -z-10"
          style={{ 
            background: 'linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--muted) / 0.3) 100%)' 
          }}
        />
        
        <div className="container relative px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-6 md:mb-14"
          >
            <h1 className="text-2xl sm:text-3xl md:text-6xl lg:text-7xl font-extrabold mb-2 md:mb-4 leading-tight">
              {t('hero.title')}
              <br />
              <span className="text-gradient">{t('hero.titleAccent')}</span>
            </h1>
            <p className="text-sm sm:text-base md:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
              {t('hero.subtitle')}
            </p>
          </motion.div>

          <SearchBar variant="hero" />

          {/* Popular Cuisines Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-wrap justify-center gap-2 mt-4 md:mt-6 max-w-3xl mx-auto"
          >
            <span className="text-sm text-muted-foreground mr-1 hidden sm:inline self-center">
              Populair:
            </span>
            {POPULAR_CUISINES.map((cuisine) => (
              <button
                key={cuisine.value}
                onClick={() => handleCuisineClick(cuisine.value)}
                className="px-3 py-1.5 text-sm font-medium rounded-full bg-card border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
              >
                {cuisine.label}
              </button>
            ))}
          </motion.div>
          
          {/* AI Surprise Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="flex justify-center mt-4 md:mt-6"
          >
            <SurpriseMe />
          </motion.div>
        </div>
      </section>

      {/* Featured Restaurants - Direct onder Surprise Me */}
      <section className="relative py-8 md:py-12 lg:py-16 bg-muted/30">
        <div className="container px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center justify-between mb-6 md:mb-10"
          >
            <h2 className="text-xl sm:text-2xl md:text-4xl font-bold">
              {t('home.featuredRestaurants', 'Uitgelichte restaurants')}
            </h2>
            <Button variant="ghost" size="sm" asChild className="text-sm">
              <Link to="/search?featured=true" className="flex items-center gap-1 md:gap-2">
                Bekijk alle
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {featuredLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard className="hidden sm:block" />
                <SkeletonCard className="hidden lg:block" />
              </>
            ) : (
              featuredRestaurants.map((restaurant, index) => (
                <DatabaseRestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  index={index}
                />
              ))
            )}
          </div>
        </div>
      </section>
      
      {/* Personalized Recommendations for logged-in users */}
      <PersonalizedRecommendations />

      {/* Curated Collections */}
      <section className="py-8 md:py-16">
        <div className="container px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center justify-between mb-4 md:mb-6"
          >
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Onze Collecties</h2>
            <Button variant="ghost" size="sm" asChild className="text-sm">
              <Link to="/collections" className="flex items-center gap-1 md:gap-2">
                Bekijk alle
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
          
          <FeaturedCollections />
        </div>
      </section>

      {/* Upcoming Events */}
      <UpcomingEvents />

      {/* Trending Dishes */}
      <TrendingDishes dishes={trendingDishes} />
    </Layout>
  );
};

export default Index;
