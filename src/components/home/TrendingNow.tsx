import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { TrendingUp, Flame, Snowflake, Sun, Leaf, Cloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrendingNow } from '@/hooks/useTrendingNow';

const seasonIcons: Record<string, React.ElementType> = {
  winter: Snowflake,
  spring: Leaf,
  summer: Sun,
  autumn: Cloud,
};

const seasonLabels: Record<string, { nl: string; en: string }> = {
  winter: { nl: 'Perfect voor een winteravond', en: 'Perfect for a winter evening' },
  spring: { nl: 'Fris voor de lente', en: 'Fresh for spring' },
  summer: { nl: 'Zomerse terrassen', en: 'Summer terraces' },
  autumn: { nl: 'Warm en gezellig', en: 'Warm and cozy' },
};

interface TrendingNowProps {
  cityId?: string;
}

export function TrendingNow({ cityId }: TrendingNowProps) {
  const { t, i18n } = useTranslation();
  const { trendingDishes, seasonalDishes, currentSeason, loading } = useTrendingNow(cityId);

  const SeasonIcon = seasonIcons[currentSeason] || Sun;
  const seasonLabel = seasonLabels[currentSeason]?.[i18n.language as 'nl' | 'en'] || seasonLabels[currentSeason]?.nl;

  if (loading) {
    return (
      <section className="py-8">
        <div className="container px-4 md:px-6">
          <Skeleton className="h-8 w-48 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 md:py-12">
      <div className="container px-4 md:px-6">
        {/* Trending Now */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <h2 className="text-xl md:text-2xl font-bold mb-4 flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            {t('trending.now', 'Trending nu')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {trendingDishes.slice(0, 4).map((dish, index) => (
              <motion.div
                key={dish.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={`/search?dish=${encodeURIComponent(dish.name)}`}
                  className="block p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-accent/50 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-semibold group-hover:text-primary transition-colors">
                        {dish.name}
                      </span>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        <span>{dish.search_count} {t('trending.searches', 'zoekopdrachten')}</span>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      #{index + 1}
                    </Badge>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Seasonal Suggestions */}
        {seasonalDishes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="p-6 rounded-2xl bg-gradient-to-br from-accent/50 to-accent border border-border">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-primary/10">
                  <SeasonIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">{seasonLabel}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t('trending.seasonalSubtitle', 'Gerechten die nu perfect passen')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {seasonalDishes.map((dish) => (
                  <Link
                    key={dish.id}
                    to={`/search?dish=${encodeURIComponent(dish.name)}`}
                    className="px-4 py-2 rounded-full bg-background border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-sm font-medium"
                  >
                    {dish.name}
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
