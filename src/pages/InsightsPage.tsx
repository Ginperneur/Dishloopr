import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Sparkles, Award, Gift, BarChart3 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BadgeDisplay } from '@/components/gamification/BadgeDisplay';
import { StatsOverview } from '@/components/gamification/StatsOverview';
import { PerksDisplay } from '@/components/gamification/PerksDisplay';
import { YearlyWrapped } from '@/components/gamification/YearlyWrapped';
import { useGamification } from '@/hooks/useGamification';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export default function InsightsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { badges, stats, perks, loading } = useGamification();

  if (!user) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <BarChart3 className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
            <h1 className="text-2xl font-bold mb-4">
              {t('insights.loginRequired', 'Log in om je inzichten te bekijken')}
            </h1>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              {t('insights.loginDescription', 'Ontdek je culinaire statistieken, verdien badges en bekijk je jaaroverzicht.')}
            </p>
            <Button asChild>
              <Link to="/login">{t('nav.login', 'Inloggen')}</Link>
            </Button>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {t('insights.title', 'Jouw Inzichten')}
          </h1>
          <p className="text-muted-foreground">
            {t('insights.subtitle', 'Statistieken, badges en jouw culinaire reis')}
          </p>
        </motion.div>

        <Tabs defaultValue="wrapped" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="wrapped" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Wrapped</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">{t('insights.stats', 'Statistieken')}</span>
            </TabsTrigger>
            <TabsTrigger value="badges" className="gap-2">
              <Award className="h-4 w-4" />
              <span className="hidden sm:inline">{t('insights.badges', 'Badges')}</span>
            </TabsTrigger>
            <TabsTrigger value="perks" className="gap-2">
              <Gift className="h-4 w-4" />
              <span className="hidden sm:inline">{t('insights.perks', 'Perks')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wrapped">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <YearlyWrapped />
            </motion.div>
          </TabsContent>

          <TabsContent value="stats">
            {loading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
                <Skeleton className="h-48" />
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <StatsOverview stats={stats} />
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="badges">
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <BadgeDisplay badges={badges} />
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="perks">
            {loading ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <PerksDisplay perks={perks} />
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
