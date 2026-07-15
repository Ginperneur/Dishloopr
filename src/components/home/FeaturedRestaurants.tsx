import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { DatabaseRestaurantCard } from '@/components/restaurant/DatabaseRestaurantCard';
import { supabase } from '@/integrations/supabase/client';
import { getEmptyRestaurantIds } from '@/lib/listableRestaurants';

/**
 * Prominent homepage slot for paid placements (is_featured / is_top_listing).
 * These listings drive Dishloopr revenue and therefore appear high on the page.
 */
export function FeaturedRestaurants() {
  const { t } = useTranslation();
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('restaurants')
          .select('*')
          .eq('is_active', true)
          .or('is_featured.eq.true,is_top_listing.eq.true')
          .order('is_top_listing', { ascending: false })
          .order('is_featured', { ascending: false })
          .order('rating', { ascending: false })
          .limit(24);
        const empty = await getEmptyRestaurantIds();
        if (cancelled) return;
        const filtered = (data ?? []).filter((r: any) => !empty.has(r.id)).slice(0, 6);
        setRestaurants(filtered);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && restaurants.length === 0) return null;

  return (
    <section
      id="featured"
      className="py-8 md:py-12 scroll-mt-24 relative"
      aria-labelledby="featured-restaurants-heading"
    >
      {/* Subtle premium backdrop */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, hsl(var(--primary) / 0.06) 0%, transparent 100%)',
        }}
      />
      <div className="container px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-4 md:mb-6 gap-3"
        >
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              {t('home.featuredLabel', 'Uitgelicht')}
            </div>
            <h2
              id="featured-restaurants-heading"
              className="text-xl sm:text-2xl md:text-3xl font-bold"
            >
              {t('home.featuredRestaurants', 'Uitgelichte restaurants')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t(
                'home.featuredRestaurantsSubtitle',
                'Handmatig gepromote plekken van onze partners',
              )}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-sm shrink-0">
            <Link to="/search?featured=1" className="flex items-center gap-1 md:gap-2">
              {t('home.viewAll', 'Bekijk alles')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            : restaurants.map((r, i) => (
                <DatabaseRestaurantCard key={r.id} restaurant={r} index={i} />
              ))}
        </div>
      </div>
    </section>
  );
}