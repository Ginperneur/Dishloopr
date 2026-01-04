import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dish } from '@/data/mockData';

interface TrendingDishesProps {
  dishes: Dish[];
  cityName?: string;
}

export function TrendingDishes({ dishes, cityName }: TrendingDishesProps) {
  const { t } = useTranslation();

  return (
    <section className="py-16">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-4">
            <TrendingUp className="h-4 w-4" />
            {t('trending.subtitle')}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold">
            {t('trending.title')}
            {cityName && (
              <span className="text-gradient ml-2">
                {t('trending.inCity', { city: cityName })}
              </span>
            )}
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {dishes.map((dish, index) => (
            <motion.div
              key={dish.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={`/search?dish=${encodeURIComponent(dish.name)}`}
                className="block p-4 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-card transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold group-hover:text-primary transition-colors">
                      {dish.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {dish.searchCount.toLocaleString()} {t('search.results').toLowerCase()}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <span className="text-lg">
                      {index < 3 ? ['🥇', '🥈', '🥉'][index] : '🍽️'}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
