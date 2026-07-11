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
import { getEmptyRestaurantIds } from '@/lib/listableRestaurants';
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

      // Dish-first: exclude restaurants without approved dishes.
      const emptyIds = await getEmptyRestaurantIds();

      // Fetch top restaurants (over-fetch so we can drop empties client-side
      // and still land on 6 cards).
      const { data: restData } = await supabase
        .from('restaurants')
        .select('*')
        .eq('city_id', cityData.id)
        .eq('is_active', true)
        .ilike('address', `%${cityData.name}%`)
        .not('images', 'is', null)
        .not('images', 'eq', '{}')
        .order('is_featured', { ascending: false })
        .order('rating', { ascending: false })
        .limit(30);

      const filteredRest = (restData || []).filter((r: any) => !emptyIds.has(r.id));
      setTopRestaurants(filteredRest.slice(0, 6));

      // Total listable count for this city — fetch all IDs, subtract empties.
      const { data: allIds } = await supabase
        .from('restaurants')
        .select('id')
        .eq('city_id', cityData.id)
        .eq('is_active', true);
      const total = (allIds || []).filter((r: any) => !emptyIds.has(r.id)).length;
      setTotalRestaurants(total);

      // Fetch popular dishes in this city, grouped by canonical_slug so
      // synonyms (e.g. "ossenhaas") aggregate under their canonical dish
      // ("biefstuk"). This mirrors what /eten/{gerecht}-{stad} shows.
      //
      // Paginated to bypass PostgREST's 1000-row default cap, and we count
      // DISTINCT restaurants per canonical (not raw dish-links).
      const pageSize = 1000;
      const rdLinks: { restaurant_id: string; dish_id: string }[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from('restaurant_dishes')
          .select('restaurant_id, dish_id, restaurants!inner(city_id, is_active)')
          .eq('restaurants.city_id', cityData.id)
          .eq('restaurants.is_active', true)
          .eq('status', 'approved_by_admin')
          .range(offset, offset + pageSize - 1);
        if (error || !data || data.length === 0) break;
        for (const row of data as any[]) {
          rdLinks.push({ restaurant_id: row.restaurant_id, dish_id: row.dish_id });
        }
        if (data.length < pageSize) break;
        offset += pageSize;
      }

      // Load dish metadata (id → name, slug, canonical_slug) for the dishes we saw.
      const uniqueDishIds = [...new Set(rdLinks.map((l) => l.dish_id))];
      const dishMeta = new Map<string, { id: string; name: string; slug: string; canonical_slug: string | null }>();
      for (let i = 0; i < uniqueDishIds.length; i += 500) {
        const chunk = uniqueDishIds.slice(i, i + 500);
        const { data: dishRows } = await supabase
          .from('dishes')
          .select('id, name, slug, canonical_slug')
          .in('id', chunk);
        (dishRows || []).forEach((d: any) => dishMeta.set(d.id, d));
      }

      // Group by canonical_slug (fallback to slug when canonical is empty),
      // and count distinct restaurants per group.
      type Group = { key: string; restaurantIds: Set<string>; repDishId: string; repName: string; repSlug: string; hasCanonical: boolean };
      const groups = new Map<string, Group>();
      for (const link of rdLinks) {
        const meta = dishMeta.get(link.dish_id);
        if (!meta) continue;
        const key = (meta.canonical_slug && meta.canonical_slug.length > 0) ? meta.canonical_slug : meta.slug;
        let g = groups.get(key);
        if (!g) {
          g = {
            key,
            restaurantIds: new Set<string>(),
            repDishId: meta.id,
            repName: meta.name,
            repSlug: meta.slug,
            hasCanonical: meta.slug === key,
          };
          groups.set(key, g);
        }
        g.restaurantIds.add(link.restaurant_id);
        // Prefer the canonical dish as representative (its slug === canonical key)
        if (!g.hasCanonical && meta.slug === key) {
          g.repDishId = meta.id;
          g.repName = meta.name;
          g.repSlug = meta.slug;
          g.hasCanonical = true;
        }
      }

      // If a group's representative isn't the true canonical dish, look it up
      // by slug so the display name and dish_id match the canonical.
      const missingCanonicalKeys = [...groups.values()].filter((g) => !g.hasCanonical).map((g) => g.key);
      if (missingCanonicalKeys.length > 0) {
        const { data: canonicals } = await supabase
          .from('dishes')
          .select('id, name, slug')
          .in('slug', missingCanonicalKeys);
        (canonicals || []).forEach((c: any) => {
          const g = groups.get(c.slug);
          if (g) {
            g.repDishId = c.id;
            g.repName = c.name;
            g.repSlug = c.slug;
            g.hasCanonical = true;
          }
        });
      }

      const dishMap = new Map<string, DishInCity>();
      for (const g of groups.values()) {
        dishMap.set(g.repDishId, {
          dishId: g.repDishId,
          dishName: g.repName,
          dishSlug: g.repSlug,
          count: g.restaurantIds.size,
          seoSlug: null,
        });
      }

      // Check SEO landing pages (keyed by the canonical dish_id).
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
        <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
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
        <h3 className="font-semibold mb-4">{t('home.discoverMore', 'Ontdek meer')}</h3>
        <div className="flex flex-wrap gap-2">
          <Link to="/steden" className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-border hover:bg-primary/10 transition-colors">
            {t('home.allCities', 'Alle steden')}
          </Link>
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
