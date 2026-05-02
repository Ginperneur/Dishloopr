import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CityRow {
  id: string;
  name: string;
  slug: string;
  restaurant_count?: number | null;
}

/**
 * Fallback / always-on discovery block: shows the user where they can start
 * exploring even if other dynamic sections (featured / trending) are empty.
 * Mobile: 2-col grid with subtle cards and a horizontal scroll fallback look.
 */
export function ExploreCities() {
  const [cities, setCities] = useState<CityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('cities')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(8);
      setCities((data as CityRow[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  if (!loading && cities.length === 0) return null;

  return (
    <section className="py-6 md:py-12">
      <div className="container px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-between mb-4 md:mb-6"
        >
          <h2 className="text-lg sm:text-xl md:text-3xl font-bold">
            Ontdek per stad
          </h2>
          <Link
            to="/steden"
            className="text-xs sm:text-sm text-primary font-medium flex items-center gap-1 hover:underline"
          >
            Alle steden
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 md:gap-3">
          {(loading ? Array.from({ length: 8 }) : cities).map((city, i) => {
            const c = city as CityRow | undefined;
            return (
              <motion.div
                key={c?.id ?? i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
              >
                {c ? (
                  <Link
                    to={`/search?city=${encodeURIComponent(c.slug)}`}
                    className="flex items-center gap-2 px-3 py-3 rounded-xl bg-card border border-border hover:border-primary hover:bg-primary/5 transition-colors min-h-[52px] touch-manipulation"
                  >
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary flex-shrink-0">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold truncate">{c.name}</span>
                  </Link>
                ) : (
                  <div className="h-[52px] rounded-xl bg-muted animate-pulse" />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}