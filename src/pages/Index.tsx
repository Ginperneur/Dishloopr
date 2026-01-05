import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { SearchBar } from '@/components/search/SearchBar';
import { Layout } from '@/components/layout/Layout';
import { TrendingDishes } from '@/components/home/TrendingDishes';
import { TrendingNow } from '@/components/home/TrendingNow';
import { UpcomingEvents } from '@/components/home/UpcomingEvents';
import { RestaurantCard } from '@/components/restaurant/RestaurantCard';
import { SurpriseMe } from '@/components/ai/SurpriseMe';
import { PersonalizedRecommendations } from '@/components/ai/PersonalizedRecommendations';
import { getTrendingDishes, restaurants } from '@/data/mockData';

const Index = () => {
  const { t } = useTranslation();
  const trendingDishes = getTrendingDishes();
  const featuredRestaurants = restaurants.filter(r => r.isFeatured || r.isTopListing).slice(0, 3);

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative py-12 md:py-32 overflow-hidden">
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
            className="text-center mb-8 md:mb-14"
          >
            <h1 className="text-3xl md:text-6xl lg:text-7xl font-extrabold mb-3 md:mb-4 leading-tight">
              {t('hero.title')}
              <br />
              <span className="text-gradient">{t('hero.titleAccent')}</span>
            </h1>
            <p className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto px-2">
              {t('hero.subtitle')}
            </p>
          </motion.div>

          <SearchBar variant="hero" />
          
          {/* AI Surprise Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="flex justify-center mt-6"
          >
            <SurpriseMe />
          </motion.div>
        </div>
      </section>
      
      {/* Personalized Recommendations for logged-in users */}
      <PersonalizedRecommendations />

      {/* Trending Now - Live trending dishes */}
      <TrendingNow />

      {/* Upcoming Events */}
      <UpcomingEvents />

      {/* Trending Dishes (legacy) */}
      <TrendingDishes dishes={trendingDishes} />

      {/* Featured Restaurants */}
      <section className="py-10 md:py-16 bg-muted/30">
        <div className="container px-4 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-6 md:mb-10"
          >
            <h2 className="text-2xl md:text-4xl font-bold">
              {t('restaurant.featured')} restaurants
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {featuredRestaurants.map((restaurant, index) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
