import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronRight, Utensils, MapPin, Search } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SEOHead, createBreadcrumbSchema } from '@/components/seo/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface SeoPagePreview {
  slug: string;
  h1_title: string;
  dish_name: string | null;
  city_name: string | null;
}

export default function DishCityIndexPage() {
  const { t } = useTranslation();
  const [pages, setPages] = useState<SeoPagePreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [uniqueDishes, setUniqueDishes] = useState<{ name: string; slug: string }[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      // Fetch cities
      const { data: citiesData } = await supabase
        .from('cities')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (citiesData) {
        setCities(citiesData);
      }

      // Fetch SEO pages with dish and city names
      const { data: pagesData } = await supabase
        .from('seo_landing_pages')
        .select(`
          slug,
          h1_title,
          dishes:dish_id (name),
          cities:city_id (id, name)
        `)
        .eq('is_active', true)
        .order('h1_title');

      if (pagesData) {
        setPages(pagesData.map(p => ({
          slug: p.slug,
          h1_title: p.h1_title,
          dish_name: p.dishes?.name || null,
          city_name: p.cities?.name || null,
          city_id: p.cities?.id || null,
        })) as SeoPagePreview[]);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  const filteredPages = pages.filter(page => {
    const matchesSearch = !searchQuery || 
      page.h1_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      page.dish_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      page.city_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCity = !selectedCity || 
      page.city_name === cities.find(c => c.id === selectedCity)?.name;

    return matchesSearch && matchesCity;
  });

  // Group pages by city
  const pagesByCity = filteredPages.reduce((acc, page) => {
    const city = page.city_name || 'Overig';
    if (!acc[city]) acc[city] = [];
    acc[city].push(page);
    return acc;
  }, {} as Record<string, SeoPagePreview[]>);

  return (
    <Layout>
      <SEOHead
        title="Eten in Nederland | Alle Gerechten per Stad | Dishloopr"
        description="Ontdek de beste restaurants per gerecht en stad. Van ramen in Amsterdam tot pizza in Rotterdam - vind jouw perfecte eetplek."
        keywords={['restaurants', 'eten', 'Nederland', 'gerechten', 'Amsterdam', 'Rotterdam']}
        canonical="https://dishloopr.com/eten"
        structuredData={createBreadcrumbSchema([
          { name: 'Home', url: 'https://dishloopr.com' },
          { name: 'Eten', url: 'https://dishloopr.com/eten' },
        ])}
      />

      {/* Breadcrumb */}
      <div className="container px-4 md:px-6 pt-4">
        <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">Eten</span>
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
            Eten in Nederland
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Ontdek de beste restaurants per gerecht en stad. Kies je favoriete gerecht en 
            vind de perfecte plek om te eten.
          </p>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op gerecht of stad..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide touch-pan-x">
              <Button
                variant={selectedCity === null ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCity(null)}
                className="shrink-0"
              >
                Alle steden
              </Button>
              {cities.map(city => (
                <Button
                  key={city.id}
                  variant={selectedCity === city.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCity(city.id)}
                  className="whitespace-nowrap shrink-0"
                >
                  {city.name}
                </Button>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Pages Grid */}
      <section className="container px-4 md:px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredPages.length > 0 ? (
          <div className="space-y-10">
            {Object.entries(pagesByCity).map(([cityName, cityPages]) => (
              <div key={cityName}>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold">{cityName}</h2>
                  <Badge variant="secondary">{cityPages.length}</Badge>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {cityPages.map((page, index) => (
                    <motion.div
                      key={page.slug}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.2) }}
                    >
                      <Link
                        to={`/eten/${page.slug}`}
                        className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors group"
                      >
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Utensils className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate group-hover:text-primary transition-colors">
                            {page.dish_name || page.h1_title}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {page.city_name}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto flex-shrink-0" />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              Geen resultaten gevonden voor "{searchQuery}"
            </p>
            <Button 
              variant="ghost" 
              onClick={() => { setSearchQuery(''); setSelectedCity(null); }}
              className="mt-4"
            >
              Wis filters
            </Button>
          </div>
        )}
      </section>

      {/* Dish Pillar Links */}
      {uniqueDishes.length > 0 && (
        <section className="container px-4 md:px-6 py-8 border-t border-border">
          <h2 className="text-xl font-bold mb-4">Zoek per gerecht</h2>
          <div className="flex flex-wrap gap-2">
            {uniqueDishes.map(dish => (
              <Link
                key={dish.slug}
                to={`/eten/gerecht/${dish.slug}`}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
              >
                {dish.name}
                <ChevronRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* City Links */}
      <section className="container px-4 md:px-6 py-8 border-t border-border">
        <h2 className="text-xl font-bold mb-4">Steden</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/steden" className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-border hover:bg-primary/10 transition-colors">
            Alle steden <ChevronRight className="h-3 w-3" />
          </Link>
          {cities.map(city => (
            <Link
              key={city.id}
              to={`/steden/${city.name.toLowerCase()}`}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-border hover:bg-primary/10 transition-colors"
            >
              {city.name}
            </Link>
          ))}
        </div>
      </section>
    </Layout>
  );
}
