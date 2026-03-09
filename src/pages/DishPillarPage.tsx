import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronRight, MapPin, Utensils, TrendingUp, ArrowRight } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead, createBreadcrumbSchema, createItemListSchema } from '@/components/seo/SEOHead';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { formatDishName } from '@/lib/utils';
import NotFound from './NotFound';

interface CityDishData {
  cityId: string;
  cityName: string;
  citySlug: string;
  restaurantCount: number;
  seoSlug: string | null;
}

export default function DishPillarPage() {
  const { dishSlug } = useParams<{ dishSlug: string }>();
  const { t } = useTranslation();
  const [dish, setDish] = useState<{ id: string; name: string; slug: string; name_en: string | null; search_count: number; synonyms: string[] | null; cuisine_tags: string[] | null } | null>(null);
  const [cityData, setCityData] = useState<CityDishData[]>([]);
  const [relatedDishes, setRelatedDishes] = useState<{ name: string; slug: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!dishSlug) return;

    async function fetchData() {
      setLoading(true);

      // Fetch dish
      const { data: dishData, error: dishError } = await supabase
        .from('dishes')
        .select('id, name, slug, name_en, search_count, synonyms, cuisine_tags')
        .eq('slug', dishSlug)
        .eq('is_active', true)
        .single();

      if (dishError || !dishData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setDish(dishData);

      // Fetch restaurant counts per city for this dish
      const { data: rdData } = await supabase
        .from('restaurant_dishes')
        .select('restaurant_id, restaurants!inner(city_id, is_active, cities!inner(id, name, slug))')
        .eq('dish_id', dishData.id)
        .in('status', ['approved_by_admin', 'verified_by_owner']);

      // Aggregate by city
      const cityMap = new Map<string, CityDishData>();
      if (rdData) {
        for (const rd of rdData as any[]) {
          const city = rd.restaurants?.cities;
          if (!city || !rd.restaurants?.is_active) continue;
          const existing = cityMap.get(city.id);
          if (existing) {
            existing.restaurantCount++;
          } else {
            cityMap.set(city.id, {
              cityId: city.id,
              cityName: city.name,
              citySlug: city.slug,
              restaurantCount: 1,
              seoSlug: null,
            });
          }
        }
      }

      // Check for SEO landing pages for each city×dish combo
      const { data: seoPages } = await supabase
        .from('seo_landing_pages')
        .select('slug, city_id')
        .eq('dish_id', dishData.id)
        .eq('is_active', true);

      if (seoPages) {
        for (const sp of seoPages) {
          if (sp.city_id) {
            const city = cityMap.get(sp.city_id);
            if (city) {
              city.seoSlug = sp.slug;
            } else {
              // City exists in SEO pages but no restaurants yet, still show it
              const { data: cityInfo } = await supabase
                .from('cities')
                .select('id, name, slug')
                .eq('id', sp.city_id)
                .single();
              if (cityInfo) {
                cityMap.set(cityInfo.id, {
                  cityId: cityInfo.id,
                  cityName: cityInfo.name,
                  citySlug: cityInfo.slug,
                  restaurantCount: 0,
                  seoSlug: sp.slug,
                });
              }
            }
          }
        }
      }

      setCityData(Array.from(cityMap.values()).sort((a, b) => b.restaurantCount - a.restaurantCount));

      // Fetch related dishes (same cuisine tags)
      if (dishData.cuisine_tags && dishData.cuisine_tags.length > 0) {
        const { data: related } = await supabase
          .from('dishes')
          .select('name, slug')
          .eq('is_active', true)
          .neq('id', dishData.id)
          .overlaps('cuisine_tags', dishData.cuisine_tags)
          .limit(8);

        setRelatedDishes(related || []);
      } else {
        // Fallback: get popular dishes
        const { data: popular } = await supabase
          .from('dishes')
          .select('name, slug')
          .eq('is_active', true)
          .neq('id', dishData.id)
          .order('search_count', { ascending: false })
          .limit(8);

        setRelatedDishes(popular || []);
      }

      setLoading(false);
    }

    fetchData();
  }, [dishSlug]);

  if (notFound) return <NotFound />;

  if (loading) {
    return (
      <Layout>
        <div className="container px-4 md:px-6 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!dish) return <NotFound />;

  const totalRestaurants = cityData.reduce((sum, c) => sum + c.restaurantCount, 0);

  const breadcrumbs = [
    { name: 'Home', url: 'https://dishloopr.com/' },
    { name: 'Eten', url: 'https://dishloopr.com/eten' },
    { name: dish.name, url: `https://dishloopr.com/eten/gerecht/${dish.slug}` },
  ];

  const itemListSchema = createItemListSchema(
    cityData.filter(c => c.seoSlug).map((c, i) => ({
      name: `${dish.name} in ${c.cityName}`,
      url: `https://dishloopr.com/eten/${c.seoSlug}`,
      position: i + 1,
    }))
  );

  return (
    <Layout>
      <SEOHead
        title={`${dish.name} - Beste restaurants in Nederland | Dishloopr`}
        description={`Ontdek de ${totalRestaurants} beste ${dish.name.toLowerCase()} restaurants in Nederland. Vergelijk per stad en vind jouw perfecte ${dish.name.toLowerCase()} in ${cityData.slice(0, 3).map(c => c.cityName).join(', ')}.`}
        keywords={[dish.name.toLowerCase(), `${dish.name.toLowerCase()} restaurant`, `beste ${dish.name.toLowerCase()}`, ...cityData.map(c => `${dish.name.toLowerCase()} ${c.cityName.toLowerCase()}`)]}
        canonical={`https://dishloopr.com/eten/gerecht/${dish.slug}`}
        structuredData={[createBreadcrumbSchema(breadcrumbs), itemListSchema]}
      />

      {/* Breadcrumb */}
      <div className="container px-4 md:px-6 pt-4">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          <ChevronRight className="h-4 w-4" />
          <Link to="/eten" className="hover:text-foreground transition-colors">Eten</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">{formatDishName(dish.name)}</span>
        </nav>
      </div>

      {/* Hero */}
      <section className="container px-4 md:px-6 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl"
        >
          <div className="flex items-center gap-2 mb-4">
            <Badge variant="secondary" className="gap-1">
              <Utensils className="h-3 w-3" />
              {formatDishName(dish.name)}
            </Badge>
            {dish.search_count > 0 && (
              <Badge variant="outline" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                {dish.search_count}× gezocht
              </Badge>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            De beste {formatDishName(dish.name).toLowerCase()} restaurants in Nederland
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            {totalRestaurants > 0
              ? `Ontdek ${totalRestaurants} restaurants die uitstekende ${formatDishName(dish.name).toLowerCase()} serveren, verspreid over ${cityData.length} ${cityData.length === 1 ? 'stad' : 'steden'} in Nederland. Vergelijk op rating, prijs en sfeer.`
              : `${formatDishName(dish.name)} wordt steeds populairder in Nederland. Bekijk de steden waar je de beste ${formatDishName(dish.name).toLowerCase()} kunt vinden.`
            }
          </p>

          {dish.synonyms && dish.synonyms.length > 0 && (
            <p className="text-sm text-muted-foreground mb-6">
              Ook bekend als: {dish.synonyms.join(', ')}
            </p>
          )}

          <Button asChild size="lg">
            <Link to={`/search?dish=${encodeURIComponent(dish.name)}`}>
              Zoek {dish.name} bij jou in de buurt
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* Cities Grid */}
      <section className="container px-4 md:px-6 py-8">
        <h2 className="text-2xl font-bold mb-6">
          {dish.name} per stad
        </h2>

        {cityData.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cityData.map((city, index) => (
              <motion.div
                key={city.cityId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.3) }}
              >
                <Link
                  to={city.seoSlug ? `/eten/${city.seoSlug}` : `/search?dish=${encodeURIComponent(dish.name)}&city=${city.cityId}`}
                  className="flex items-center gap-4 p-5 rounded-xl border bg-card hover:bg-accent/50 transition-colors group"
                >
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-lg group-hover:text-primary transition-colors">
                      {dish.name} in {city.cityName}
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
        ) : (
          <div className="text-center py-12 bg-muted/30 rounded-xl">
            <p className="text-muted-foreground">
              Nog geen restaurants gevonden die {dish.name.toLowerCase()} serveren.
            </p>
            <Button asChild className="mt-4">
              <Link to="/search">Bekijk alle restaurants</Link>
            </Button>
          </div>
        )}
      </section>

      {/* Related Dishes */}
      {relatedDishes.length > 0 && (
        <section className="container px-4 md:px-6 py-8 border-t border-border">
          <h2 className="text-2xl font-bold mb-6">
            Vergelijkbare gerechten
          </h2>
          <div className="flex flex-wrap gap-3">
            {relatedDishes.map((rd) => (
              <Link
                key={rd.slug}
                to={`/eten/gerecht/${rd.slug}`}
                className="inline-flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-full border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
              >
                {rd.name}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* All Dishes Link */}
      <section className="container px-4 md:px-6 py-8 border-t border-border">
        <h3 className="font-semibold mb-4">Ontdek meer</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/eten">Alle gerechten</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/steden">Alle steden</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/collections">Collecties</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
}
