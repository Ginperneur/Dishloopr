import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  PieChart, 
  MapPin, 
  Star, 
  Camera, 
  TrendingUp,
  Utensils
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface UserStats {
  cuisines_tried: string[];
  cities_visited: string[];
  total_restaurants_visited: number;
  total_reviews_written: number;
  favorite_cuisine: string | null;
  streak_days: number;
}

interface StatsOverviewProps {
  stats: UserStats | null;
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  const { t } = useTranslation();

  if (!stats) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Utensils className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{t('stats.noData', 'Begin met reviewen om je statistieken te zien!')}</p>
      </div>
    );
  }

  const cuisineCount = stats.cuisines_tried?.length || 0;
  const cityCount = stats.cities_visited?.length || 0;

  const statCards = [
    {
      icon: Star,
      label: t('stats.totalReviews', 'Reviews'),
      value: stats.total_reviews_written,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      icon: PieChart,
      label: t('stats.cuisinesTried', 'Keukens'),
      value: cuisineCount,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      icon: MapPin,
      label: t('stats.citiesVisited', 'Steden'),
      value: cityCount,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      icon: TrendingUp,
      label: t('stats.streak', 'Streak'),
      value: `${stats.streak_days} ${t('stats.days', 'dagen')}`,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Cuisine Diversity */}
      {cuisineCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="h-5 w-5 text-blue-500" />
              {t('stats.cuisineDiversity', 'Keuken Diversiteit')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('stats.progress', 'Voortgang naar Keuken Ontdekker')}
                </span>
                <span className="font-semibold">{cuisineCount}/10</span>
              </div>
              <Progress value={(cuisineCount / 10) * 100} className="h-2" />
              
              <div className="flex flex-wrap gap-2 mt-4">
                {stats.cuisines_tried?.map((cuisine) => (
                  <span
                    key={cuisine}
                    className="px-3 py-1 rounded-full bg-accent text-sm font-medium capitalize"
                  >
                    {cuisine}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cities Visited */}
      {cityCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5 text-purple-500" />
              {t('stats.citiesExplored', 'Bezochte Steden')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('stats.cityProgress', 'Voortgang naar Steden Hopper')}
                </span>
                <span className="font-semibold">{cityCount}/5</span>
              </div>
              <Progress value={(cityCount / 5) * 100} className="h-2" />
              
              <div className="flex flex-wrap gap-2 mt-4">
                {stats.cities_visited?.map((city) => (
                  <span
                    key={city}
                    className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm font-medium"
                  >
                    {city}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Favorite Cuisine */}
      {stats.favorite_cuisine && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Utensils className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('stats.favoriteCuisine', 'Je favoriete keuken')}
                </p>
                <p className="text-xl font-bold capitalize">{stats.favorite_cuisine}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
