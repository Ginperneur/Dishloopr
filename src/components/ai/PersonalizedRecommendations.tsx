import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAIRecommendations } from '@/hooks/useAIRecommendations';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function PersonalizedRecommendations() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { favorites } = useFavorites();
  const { personalized, loading, getPersonalizedRecommendations } = useAIRecommendations();
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (user && favorites.length > 0 && !hasLoaded) {
      // Get recent searches from localStorage
      const recentSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
      getPersonalizedRecommendations(favorites, recentSearches);
      setHasLoaded(true);
    }
  }, [user, favorites, hasLoaded, getPersonalizedRecommendations]);

  if (!user || favorites.length === 0) {
    return null;
  }

  if (loading) {
    return (
      <section className="py-8 md:py-12">
        <div className="container px-4 md:px-6">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-xl md:text-2xl font-bold">{t('ai.forYou', 'Voor jou geselecteerd')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (personalized.length === 0) {
    return null;
  }

  return (
    <section className="py-8 md:py-12">
      <div className="container px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center gap-2 mb-6"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-orange-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-xl md:text-2xl font-bold">{t('ai.forYou', 'Voor jou geselecteerd')}</h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {personalized.map((rec, index) => (
            <motion.div
              key={rec.dish}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative bg-card border border-border rounded-xl p-5 hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer"
              onClick={() => navigate(`/search?q=${encodeURIComponent(rec.dish)}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                  {rec.dish}
                </h3>
                <div className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  {rec.matchScore}%
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{rec.reason}</p>
              <div className="flex items-center text-sm text-primary font-medium group-hover:gap-2 transition-all">
                {t('ai.exploreNow', 'Ontdek nu')}
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
