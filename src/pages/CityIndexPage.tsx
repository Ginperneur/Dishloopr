import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronRight, MapPin, Utensils, ArrowRight } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead, createBreadcrumbSchema, createItemListSchema } from '@/components/seo/SEOHead';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { getEmptyRestaurantIds } from '@/lib/listableRestaurants';

interface CityOverview {
  id: string;
  name: string;
  slug: string;
  restaurantCount: number;
}

export default function CityIndexPage() {
  const { t } = useTranslation();
  const [cities, setCities] = useState<CityOverview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCities() {
      const { data: citiesData, error: citiesErr } = await supabase
        .from('cities')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');

      if (citiesErr || !citiesData) {
        console.error('[CityIndexPage] cities fetch failed', citiesErr);
        setLoading(false);
        return;
      }

      // Dish-first: only count active restaurants with ≥1 approved dish.
      // Fetch all active restaurants + city_id (paginated), then subtract the
      // empty set per city.
      const emptyIds = await getEmptyRestaurantIds();
      const perCity = new Map<string, number>();
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from('restaurants')
          .select('id, city_id')
          .eq('is_active', true)
          .range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        for (const r of data as any[]) {
          if (!r.city_id || emptyIds.has(r.id)) continue;
          perCity.set(r.city_id, (perCity.get(r.city_id) || 0) + 1);
        }
        if (data.length < pageSize) break;
        from += pageSize;
      }

      const cityOverviews: CityOverview[] = citiesData.map((c) => ({
        ...c,
        restaurantCount: perCity.get(c.id) ?? 0,
      }));

      setCities(cityOverviews.sort((a, b) => b.restaurantCount - a.restaurantCount));
      setLoading(false);
    }

    fetchCities();
  }, []);

  const totalRestaurants = cities.reduce((sum, c) => sum + c.restaurantCount, 0);

  const breadcrumbs = [
    { name: 'Home', url: 'https://dishloopr.com/' },
    { name: 'Steden', url: 'https://dishloopr.com/steden' },
  ];

  const itemListSchema = createItemListSchema(
    cities.map((city, i) => ({
      name: `Restaurants in ${city.name}`,
      url: `https://dishloopr.com/steden/${city.slug}`,
      position: i + 1,
    }))
  );

  return (
    <Layout>
      <SEOHead
        title="Restaurants per Stad in Nederland | Dishloopr"
        description={`Ontdek ${totalRestaurants}+ restaurants in ${cities.length} steden in Nederland. Vind de beste eetgelegenheden van Amsterdam tot Rotterdam.`}
        keywords={['restaurants Nederland', 'uit eten', ...cities.map(c => `restaurants ${c.name.toLowerCase()}`)]}
        canonical="https://dishloopr.com/steden"
        structuredData={[createBreadcrumbSchema(breadcrumbs), itemListSchema]}
      />

      {/* Breadcrumb */}
      <div className="container px-4 md:px-6 pt-4">
        <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Steden</span>
        </nav>
      </div>

      {/* Hero */}
      <section className="container px-4 md:px-6 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl"
        >
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Restaurants per stad
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Ontdek {totalRestaurants}+ restaurants in {cities.length} steden. Kies een stad en vind de beste gerechten bij jou in de buurt.
          </p>
        </motion.div>
      </section>

      {/* Cities Grid */}
      <section className="container px-4 md:px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cities.map((city, index) => (
              <motion.div
                key={city.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.3) }}
              >
                <Link
                  to={`/steden/${city.slug}`}
                  className="flex items-center gap-4 p-5 rounded-xl border bg-card hover:bg-accent/50 transition-colors group"
                >
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-lg group-hover:text-primary transition-colors">
                      {city.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {city.restaurantCount} {city.restaurantCount === 1 ? 'restaurant' : 'restaurants'}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Internal Links */}
      <section className="container px-4 md:px-6 py-8 border-t border-border">
        <h3 className="font-semibold mb-4">{t('home.discoverMore', 'Ontdek meer')}</h3>
        <div className="flex flex-wrap gap-2">
          <Link to="/eten" className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-border hover:bg-primary/10 transition-colors">
            <Utensils className="h-3 w-3" /> {t('home.allDishes', 'Alle gerechten')}
          </Link>
          <Link to="/collections" className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-border hover:bg-primary/10 transition-colors">
            {t('home.collectionsLabel', 'Collecties')}
          </Link>
        </div>
      </section>
    </Layout>
  );
}
