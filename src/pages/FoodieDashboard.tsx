import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Utensils, Settings } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useGamification } from '@/hooks/useGamification';
import { useFavorites } from '@/hooks/useFavorites';
import { supabase } from '@/integrations/supabase/client';
import { SEOHead } from '@/components/seo/SEOHead';
import { WelcomeHero } from '@/components/foodie/WelcomeHero';
import { StatsGrid } from '@/components/foodie/StatsGrid';
import { GettingStarted } from '@/components/foodie/GettingStarted';
import { MyListsSection } from '@/components/foodie/MyListsSection';
import { FavoritesPreview } from '@/components/foodie/FavoritesPreview';
import { GroupDecisionTool } from '@/components/group/GroupDecisionTool';

interface ProfileData {
  name: string | null;
  avatar_url: string | null;
  total_reviews: number | null;
  reviewer_level: string | null;
}

const levelConfig: Record<string, { label: string; color: string; next: string; threshold: number }> = {
  bronze: { label: 'Bronze Foodie', color: 'bg-amber-700 text-white', next: 'silver', threshold: 10 },
  silver: { label: 'Silver Foodie', color: 'bg-gray-400 text-white', next: 'gold', threshold: 25 },
  gold: { label: 'Gold Foodie', color: 'bg-amber-500 text-white', next: 'platinum', threshold: 50 },
  platinum: { label: 'Platinum Foodie', color: 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white', next: '', threshold: 999 },
};

export default function FoodieDashboard() {
  const { user, loading: authLoading } = useAuth();
  const { badges, stats } = useGamification();
  const { favorites } = useFavorites();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const profileRes = await supabase
        .from('profiles')
        .select('name, avatar_url, total_reviews, reviewer_level')
        .eq('id', user.id)
        .single();
      if (profileRes.data) setProfile(profileRes.data);
      setProfileLoading(false);
    };
    fetchData();
  }, [user]);

  if (authLoading) {
    return (
      <Layout>
        <div className="container py-16 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Utensils className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-4">Mijn Foodie Dashboard</h1>
          <p className="text-muted-foreground mb-6">Log in om je foodie-profiel te bekijken.</p>
          <Button asChild><Link to="/login">Inloggen</Link></Button>
        </div>
      </Layout>
    );
  }

  const level = profile?.reviewer_level || 'bronze';
  const levelInfo = levelConfig[level] || levelConfig.bronze;
  const reviewCount = profile?.total_reviews || 0;
  const earnedBadges = badges.filter(b => b.earned_at).length;

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

  return (
    <Layout>
      <SEOHead title="Mijn Dashboard | Dishloopr" description="Jouw persoonlijke foodie dashboard" noindex />
      
      <div className="container py-5 sm:py-8 px-4 max-w-3xl mx-auto">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-4 sm:space-y-5"
        >
          {/* Welcome Hero */}
          <motion.div variants={fadeUp}>
            {profileLoading ? (
              <div className="h-28 sm:h-32 rounded-2xl bg-muted animate-pulse" />
            ) : (
              <WelcomeHero
                name={profile?.name || null}
                avatarUrl={profile?.avatar_url || null}
                email={user?.email}
                level={level}
                levelLabel={levelInfo.label}
                levelColor={levelInfo.color}
                nextLevelLabel={levelConfig[levelInfo.next]?.label || ''}
                reviewCount={reviewCount}
                nextLevelThreshold={levelInfo.threshold}
                hasNextLevel={!!levelInfo.next}
              />
            )}
          </motion.div>

          {/* Stats */}
          <motion.div variants={fadeUp}>
            <StatsGrid
              reviewCount={reviewCount}
              favoritesCount={favorites.length}
              badgesCount={earnedBadges}
              citiesCount={stats?.cities_visited?.length || 0}
            />
          </motion.div>

          {/* Mijn lijstjes — prominente hoofdsectie */}
          <motion.div variants={fadeUp}>
            <MyListsSection />
          </motion.div>

          {/* Favorieten preview */}
          <motion.div variants={fadeUp}>
            <FavoritesPreview />
          </motion.div>

          {/* Getting Started — hides itself when all steps complete */}
          <motion.div variants={fadeUp}>
            <GettingStarted
              hasProfile={!!profile?.name}
              hasReviews={reviewCount > 0}
              hasFavorites={favorites.length > 0}
            />
          </motion.div>

          {/* Group Decision Tool */}
          <motion.div variants={fadeUp}>
            <GroupDecisionTool />
          </motion.div>

          {/* Profielinstellingen (mobiel) */}
          <motion.div variants={fadeUp} className="sm:hidden">
            <Button variant="outline" asChild className="w-full min-h-[44px]">
              <Link to="/profile">
                <Settings className="h-4 w-4 mr-2" />
                Profielinstellingen
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  );
}
