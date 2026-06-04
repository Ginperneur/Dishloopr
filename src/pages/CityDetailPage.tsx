import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronRight, MapPin, Utensils, ArrowRight, Star } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead, createBreadcrumbSchema, createItemListSchema } from '@/components/seo/SEOHead';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatabaseRestaurantCard } from '@/components/restaurant/DatabaseRestaurantCard';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { supabase } from '@/integrations/supabase/client';
import NotFound from './NotFound';

interface DishInCity {
  dishId: string;
  dishName: string;
  dishSlug: string;
  count: number;
  seoSlug: string | null;
}

export default function CityDetailPage() {
  const { citySlug } = useParams<{ citySlug: string }>();
  const { t } = useTranslation();
  const [city, setCity] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [dishes, setDishes] = useState<DishInCity[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<any[]>([]);
  const [totalRestaurants, setTotalRestaurants] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!citySlug) return;

    async function fetchData() {
      setLoading(true);

      // Fetch city
      const { data: cityData, error: cityError } = await supabase
        .from('cities')
        .select('id, name, slug')
        .eq('slug', citySlug)
        .eq('is_active', true)
        .single();

      if (cityError || !cityData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setCity(cityData);

      // Fetch top restaurants
      const { data: restData, count } = await supabase
        .from('restaurants')
        .select('*', { count: 'exact' })
        .eq('city_id', cityData.id)
        .eq('is_active', true)
        .not('images', 'is', null)
        .not('images', 'eq', '{}')
        .order('is_featured', { ascending: false })
        .order('rating', { ascending: false })
        .limit(6);

      setTopRestaurants(restData || []);
      setTotalRestaurants(count || 0);

      // Fetch popular dishes in this city
      const { data: rdData } = await supabase
        .from('restaurant_dishes')
        .select('dish_id, dishes!inner(id, name, slug), restaurants!inner(city_id, is_active)')
        .eq('restaurants.city_id', cityData.id)
        .eq('restaurants.is_active', true)
        .in('status', ['approved_by_admin', 'verified_by_owner']);

      const dishMap = new Map<string, DishInCity>();
      if (rdData) {
        for (const rd of rdData as any[]) {
          const d = rd.dishes;
          if (!d) continue;
          const existing = dishMap.get(d.id);
          if (existing) {
            existing.count++;
          } else {
            dishMap.set(d.id, {
              dishId: d.id,
              dishName: d.name,
              dishSlug: d.slug,
              count: 1,
              seoSlug: null,
            });
          }
        }
      }

      // Check SEO landing pages
      const { data: seoPages } = await supabase
        .from('seo_landing_pages')
        .select('slug, dish_id')
        .eq('city_id', cityData.id)
        .eq('is_active', true);

      if (seoPages) {
        for (const sp of seoPages) {
          if (sp.dish_id) {
            const existing = dishMap.get(sp.dish_id);
            if (existing) {
              existing.seoSlug = sp.slug;
            }
          }
        }
      }

      setDishes(Array.from(dishMap.values()).sort((a, b) => b.count - a.count));
      setLoading(false);
    }

    fetchData();
  }, [citySlug]);

  if (notFound) return <NotFound />;

  if (loading) {
    return (
      <Layout>
        <div className="container px-4 md:px-6 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-8">
            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        </div>
      </Layout>
    );
  }

  if (!city) return <NotFound />;

  const breadcrumbs = [
    { name: 'Home', url: 'https://dishloopr.com/' },
    { name: 'Steden', url: 'https://dishloopr.com/steden' },
    { name: city.name, url: `https://dishloopr.com/steden/${city.slug}` },
  ];

  return (
    <Layout>
      <SEOHead
        title={`Beste restaurants in ${city.name} | Dishloopr`}
        description={`Ontdek ${totalRestaurants} restaurants in ${city.name}. Van ${dishes.slice(0, 3).map(d => d.dishName.toLowerCase()).join(' tot ')} - vind de beste eetgelegenheden.`}
        keywords={[`restaurants ${city.name.toLowerCase()}`, `uit eten ${city.name.toLowerCase()}`, `eten ${city.name.toLowerCase()}`, ...dishes.slice(0, 5).map(d => `${d.dishName.toLowerCase()} ${city.name.toLowerCase()}`)]}
        canonical={`https://dishloopr.com/steden/${city.slug}`}
        structuredData={createBreadcrumbSchema(breadcrumbs)}
      />

      {/* Breadcrumb */}
      <div className="container px-4 md:px-6 pt-4">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <Link to="/steden" className="hover:text-foreground transition-colors">Steden</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">{city.name}</span>
        </nav>
      </div>

      {/* Hero */}
      <section className="container px-4 md:px-6 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl"
        >
          <Badge variant="outline" className="gap-1 mb-4">
            <MapPin className="h-3 w-3" />
            {city.name}
          </Badge>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Beste restaurants in {city.name}
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            Ontdek {totalRestaurants} restaurants in {city.name}. Zoek op gerecht, vergelijk reviews en vind jouw perfecte eetplek.
          </p>

          <Button asChild size="lg">
            <Link to={`/search?city=${city.id}`}>
              Zoek restaurants in {city.name}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* Popular Dishes in City */}
      {dishes.length > 0 && (
        <section className="container px-4 md:px-6 py-8">
          <h2 className="text-2xl font-bold mb-6">
            Populaire gerechten in {city.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {dishes.slice(0, 12).map((dish, index) => (
              <motion.div
                key={dish.dishId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.2) }}
              >
                <Link
                  to={dish.seoSlug ? `/eten/${dish.seoSlug}` : `/search?dish=${encodeURIComponent(dish.dishName)}&city=${city.id}`}
                  className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors group"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Utensils className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate group-hover:text-primary transition-colors">
                      {dish.dishName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {dish.count} {dish.count === 1 ? 'restaurant' : 'restaurants'}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Top Restaurants */}
      <section className="container px-4 md:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            Top restaurants in {city.name}
          </h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/search?city=${city.id}`} className="flex items-center gap-1">
              Bekijk alles <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {topRestaurants.map((restaurant, index) => (
            <motion.div
              key={restaurant.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.05, 0.3) }}
            >
              <DatabaseRestaurantCard restaurant={restaurant} index={index} />
            </motion.div>
          ))}
        </div>
      </section>

      {/* Internal Links */}
      <section className="container px-4 md:px-6 py-8 border-t border-border">
        <h3 className="font-semibold mb-4">Ontdek meer</h3>
        <div className="flex flex-wrap gap-2">
          <Link to="/steden" className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-border hover:bg-primary/10 transition-colors">
            Alle steden
          </Link>
          <Link to="/eten" className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-border hover:bg-primary/10 transition-colors">
            <Utensils className="h-3 w-3" /> Alle gerechten
          </Link>
          <Link to="/collections" className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-border hover:bg-primary/10 transition-colors">
            Collecties
          </Link>
        </div>
      </section>
    </Layout>
  );
}
