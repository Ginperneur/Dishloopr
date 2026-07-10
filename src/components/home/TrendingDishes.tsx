import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { formatDishName } from '@/lib/utils';
import type { TrendingDish } from '@/hooks/useTrendingDishes';

interface TrendingDishesProps {
  dishes: TrendingDish[];
  cityName?: string;
}

export function TrendingDishes({ dishes, cityName }: TrendingDishesProps) {
  const { t } = useTranslation();

  // Hide section when there is no data (handled by parent fallback to keep page meaningful)
  if (dishes.length === 0) return null;

  return (
    <section className="py-10 md:py-10">
      <div className="container px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-between mb-4 md:mb-6"
        >
          <div className="text-center flex-1">
            <div className="inline-flex items-center gap-2 px-3 md:px-4 py-1 md:py-1.5 rounded-full bg-accent text-accent-foreground text-xs md:text-sm font-medium mb-3 md:mb-4">
              <TrendingUp className="h-3.5 w-3.5 md:h-4 md:w-4" />
              {t('trending.subtitle')}
            </div>
            <h2 className="text-2xl md:text-4xl font-bold">
              {t('trending.title')}
              {cityName && (
                <span className="text-gradient ml-2">
                  {t('trending.inCity', { city: cityName })}
                </span>
              )}
            </h2>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden md:flex">
            <Link to="/eten" className="flex items-center gap-2">
              {t('home.allDishes', 'Alle gerechten')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4">
          {dishes.map((dish, index) => (
            <motion.div
              key={dish.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={dish.slug ? `/eten/gerecht/${dish.slug}` : `/search?dish=${encodeURIComponent(dish.name.toLowerCase())}`}
                className="block p-3 md:p-4 rounded-xl md:rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-card transition-all group"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm md:text-base group-hover:text-primary transition-colors truncate">
                      {formatDishName(dish.name)}
                    </h3>
                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                      {dish.restaurant_count} {dish.restaurant_count === 1 ? t('stats.restaurants', 'restaurant').replace(/s$/i,'') : t('stats.restaurants', 'restaurants')}
                    </p>
                  </div>
                  <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-accent flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                    <span className="text-base md:text-lg">
                      {index < 3 ? ['🥇', '🥈', '🥉'][index] : '🍽️'}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex justify-center mt-6 md:hidden"
        >
          <Button variant="outline" asChild>
            <Link to="/eten" className="flex items-center gap-2">
              {t('home.viewAllDishes', 'Bekijk alle gerechten')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
