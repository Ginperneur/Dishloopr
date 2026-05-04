import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Utensils, Star, MapPin, ChefHat } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Stats {
  restaurants: number;
  reviews: number;
  cities: number;
  dishes: number;
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
  const [stats, setStats] = useState<Stats>({ restaurants: 0, reviews: 0, cities: 0, dishes: 0 });

  useEffect(() => {
    async function fetchStats() {
      const [restaurantsRes, reviewsRes, citiesRes, dishesRes] = await Promise.all([
        supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('reviews').select('id', { count: 'exact', head: true }),
        supabase.from('cities').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('restaurant_dishes').select('id', { count: 'exact', head: true }).in('status', ['approved_by_admin', 'verified_by_owner']),
      ]);

      setStats({
        restaurants: restaurantsRes.count || 0,
        reviews: reviewsRes.count || 0,
        cities: citiesRes.count || 0,
        dishes: dishesRes.count || 0,
      });
    }
    fetchStats();
  }, []);

  // Always show all four stats — even small numbers signal real activity
  // and beat an empty section.
  const items = [
    { icon: Utensils, value: stats.restaurants, label: 'Restaurants', suffix: '+' },
    { icon: Star, value: stats.reviews, label: 'Reviews', suffix: '+' },
    { icon: MapPin, value: stats.cities, label: 'Steden', suffix: '' },
    { icon: ChefHat, value: stats.dishes, label: 'Gerechten', suffix: '+' },
  ];

  return (
    <section
      className="py-4 md:py-6 border-y border-border/50 bg-muted/20"
      aria-label="Statistieken over Dishloopr"
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
