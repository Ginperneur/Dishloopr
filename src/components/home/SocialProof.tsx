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

  // Hide stats with weak social proof (e.g. "1+ Reviews" sends a negative signal)
  const REVIEW_THRESHOLD = 25;
  const DISH_THRESHOLD = 10;
  const CITY_THRESHOLD = 3;
  const RESTAURANT_THRESHOLD = 10;

  const items = [
    ...(stats.restaurants >= RESTAURANT_THRESHOLD
      ? [{ icon: Utensils, value: stats.restaurants, label: 'Restaurants', suffix: '+' }]
      : []),
    ...(stats.reviews >= REVIEW_THRESHOLD
      ? [{ icon: Star, value: stats.reviews, label: 'Reviews', suffix: '+' }]
      : []),
    ...(stats.cities >= CITY_THRESHOLD
      ? [{ icon: MapPin, value: stats.cities, label: 'Steden', suffix: '' }]
      : []),
    ...(stats.dishes >= DISH_THRESHOLD
      ? [{ icon: ChefHat, value: stats.dishes, label: 'Gerechten', suffix: '+' }]
      : []),
  ];

  // If we have fewer than 2 trustworthy stats, hide the section entirely
  if (items.length < 2) return null;

  // Adapt grid columns to number of items so layout stays balanced
  const gridColsClass =
    items.length === 2
      ? 'grid-cols-2'
      : items.length === 3
      ? 'grid-cols-3'
      : 'grid-cols-2 md:grid-cols-4';

  return (
    <section className="py-6 md:py-10 border-y border-border/50">
      <div className="container px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={`grid ${gridColsClass} gap-6 md:gap-8`}
        >
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 text-primary mb-2 md:mb-3">
                <item.icon className="h-5 w-5 md:h-6 md:w-6" />
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-foreground font-display">
                <AnimatedCounter value={item.value} suffix={item.suffix} />
              </div>
              <div className="text-xs md:text-sm text-muted-foreground font-medium mt-0.5">
                {item.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
