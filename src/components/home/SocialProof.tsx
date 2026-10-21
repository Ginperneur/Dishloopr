import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Utensils, Star, MapPin, Store } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { roundDownHundreds } from '@/lib/utils';

interface Stats {
  restaurants: number;
  reviews: number;
  cities: number;
  dishes: number;
}

// Module-level cache so stats are stable across language switches / remounts
let cachedStats: Stats | null = null;
let inflight: Promise<Stats> | null = null;

async function loadStats(): Promise<Stats> {
  if (cachedStats) return cachedStats;
  if (inflight) return inflight;
  inflight = (async () => {
    const [restaurantsRes, reviewsRes, citiesRes, dishesRes] = await Promise.all([
      supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('cities').select('id, restaurants!inner(id)', { count: 'exact', head: true }).eq('restaurants.is_active', true),
      supabase.from('restaurant_dishes').select('id', { count: 'exact', head: true }).in('status', ['approved_by_admin', 'verified_by_owner']),
    ]);
    const result: Stats = {
      restaurants: roundDownHundreds(restaurantsRes.count || 0),
      reviews: reviewsRes.count || 0,
      cities: roundDownHundreds(citiesRes.count || 0),
      dishes: roundDownHundreds(dishesRes.count || 0),
    };
    cachedStats = result;
    return result;
  })();
  return inflight;
}

function AnimatedCounter({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    const duration = 1500;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <span className="tabular-nums">
      {count.toLocaleString('nl-NL')}{suffix}
    </span>
  );
}

export function SocialProof() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats>(() => cachedStats ?? { restaurants: 0, reviews: 0, cities: 0, dishes: 0 });

  useEffect(() => {
    let cancelled = false;
    loadStats().then((s) => {
      if (!cancelled) setStats(s);
    });
    return () => { cancelled = true; };
  }, []);

  // Only show "+" suffix once a stat reaches a meaningful threshold,
  // and hide stats that are still empty so we never render "0+".
  const plus = (n: number) => (n >= 10 ? '+' : '');
  const REVIEWS_MIN = 10;
  const items = [
    { icon: Store, value: stats.restaurants, label: t('stats.restaurants', 'Restaurants'), suffix: plus(stats.restaurants), show: stats.restaurants > 0 },
    { icon: Star, value: stats.reviews, label: t('stats.reviews', 'Reviews'), suffix: plus(stats.reviews), show: stats.reviews >= REVIEWS_MIN },
    { icon: MapPin, value: stats.cities, label: t('stats.cities', 'Steden'), suffix: '', show: stats.cities > 0 },
    { icon: Utensils, value: stats.dishes, label: t('stats.dishes', 'Gerechten'), suffix: plus(stats.dishes), show: stats.dishes > 0 },
  ].filter((item) => item.show);

  return (
    <section
      className="py-4 md:py-6 border-y border-border/50 bg-muted/20"
      aria-label={t('stats.aria', 'Statistieken over Dishloopr')}
    >
      <div className="container px-4 md:px-6">
        {/* Mobile: horizontal scroll strip */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="md:hidden -mx-4 px-4"
        >
          <ul className="flex gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory list-none m-0 p-0">
            {items.map((item) => (
              <li
                key={item.label}
                className="shrink-0 snap-start inline-flex items-center gap-2 px-3 py-2 rounded-full bg-card border border-border"
              >
                <item.icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span className="text-sm font-bold text-foreground tabular-nums">
                  <AnimatedCounter value={item.value} suffix={item.suffix} />
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Desktop: centered inline strip */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="hidden md:flex items-center justify-center gap-8 lg:gap-12"
        >
          {items.map((item, idx) => (
            <div key={item.label} className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary" aria-hidden="true">
                <item.icon className="h-4 w-4" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-extrabold text-foreground font-display">
                  <AnimatedCounter value={item.value} suffix={item.suffix} />
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  {item.label}
                </span>
              </div>
              {idx < items.length - 1 && (
                <div className="hidden lg:block h-8 w-px bg-border ml-4" />
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
