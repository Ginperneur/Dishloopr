import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Heart, Star, MapPin, Search, Award, Camera,
  ChevronRight, Utensils, TrendingUp, BookOpen, Sparkles
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useGamification } from '@/hooks/useGamification';
import { useFavorites } from '@/hooks/useFavorites';
import { supabase } from '@/integrations/supabase/client';
import { SEOHead } from '@/components/seo/SEOHead';

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
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { badges, stats, loading: gamificationLoading } = useGamification();
  const { favorites } = useFavorites();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    
    // Fetch profile and recent reviews in parallel
    const fetchData = async () => {
      const [profileRes, reviewsRes] = await Promise.all([
        supabase.from('profiles').select('name, avatar_url, total_reviews, reviewer_level').eq('id', user.id).single(),
        supabase.from('reviews').select('id, rating, title, created_at, restaurant_id, restaurants(name, slug)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      if (reviewsRes.data) setRecentReviews(reviewsRes.data);
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
  const nextLevelThreshold = levelInfo.threshold;
  const levelProgress = Math.min((reviewCount / nextLevelThreshold) * 100, 100);

  const userInitials = profile?.name
    ? profile.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  const quickActions = [
    { icon: Search, label: 'Ontdek restaurants', to: '/search', color: 'bg-primary/10 text-primary' },
    { icon: BookOpen, label: 'Collecties bekijken', to: '/collections', color: 'bg-blue-500/10 text-blue-500' },
    { icon: Heart, label: 'Mijn favorieten', to: '/favorites', color: 'bg-rose-500/10 text-rose-500' },
    { icon: Sparkles, label: 'Mijn inzichten', to: '/insights', color: 'bg-purple-500/10 text-purple-500' },
  ];

  return (
    <Layout>
      <SEOHead title="Mijn Dashboard | Dishloopr" description="Jouw persoonlijke foodie dashboard" noindex />
      <div className="container py-6 md:py-10 px-4 max-w-4xl mx-auto space-y-6">
        
        {/* Welcome Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-6 md:p-8"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <Avatar className="w-16 h-16 md:w-20 md:h-20 shrink-0">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl md:text-2xl">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-bold truncate">
                  Hoi, {profile?.name || 'Foodie'}! 👋
                </h1>
                <Badge className={`${levelInfo.color} shrink-0`}>
                  {levelInfo.label}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 text-sm md:text-base">
                Welkom terug bij je culinaire reis.
              </p>
              {levelInfo.next && (
                <div className="mt-3 max-w-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Nog {Math.max(0, nextLevelThreshold - reviewCount)} reviews tot {levelConfig[levelInfo.next]?.label}</span>
                    <span>{reviewCount}/{nextLevelThreshold}</span>
                  </div>
                  <Progress value={levelProgress} className="h-2" />
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
        >
          {[
            { icon: Star, label: 'Reviews', value: reviewCount, color: 'text-amber-500', bg: 'bg-amber-500/10' },
            { icon: Heart, label: 'Favorieten', value: favorites.length, color: 'text-rose-500', bg: 'bg-rose-500/10' },
            { icon: Award, label: 'Badges', value: earnedBadges, color: 'text-purple-500', bg: 'bg-purple-500/10' },
            { icon: MapPin, label: 'Steden', value: stats?.cities_visited?.length || 0, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          ].map((stat, i) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="text-lg font-semibold mb-3">Snelle acties</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors text-center group"
              >
                <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <span className="text-sm font-medium">{action.label}</span>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Recent Reviews */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Recente reviews</h2>
            {recentReviews.length > 0 && (
              <Link to="/insights" className="text-sm text-primary hover:underline flex items-center gap-1">
                Alles bekijken <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          {recentReviews.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Star className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="font-medium mb-1">Nog geen reviews geschreven</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Deel je ervaring en help andere foodies met hun keuze!
                </p>
                <Button asChild size="sm">
                  <Link to="/search">
                    <Search className="h-4 w-4 mr-2" />
                    Zoek een restaurant
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentReviews.map((review) => (
                <Link
                  key={review.id}
                  to={`/restaurant/${(review as any).restaurants?.slug || ''}`}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-1 shrink-0">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${
                          i < review.rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {(review as any).restaurants?.name || 'Restaurant'}
                    </p>
                    {review.title && (
                      <p className="text-xs text-muted-foreground truncate">{review.title}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(review.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </motion.div>

        {/* Badges Preview */}
        {badges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Badges</h2>
              <Link to="/insights?tab=badges" className="text-sm text-primary hover:underline flex items-center gap-1">
                Alle bekijken <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              {badges.slice(0, 6).map((badge) => {
                const isEarned = !!badge.earned_at;
                return (
                  <div
                    key={badge.badge_type}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center ${
                      isEarned ? 'border-primary/30 bg-primary/5' : 'border-border bg-card opacity-60'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isEarned ? 'bg-primary/20' : 'bg-muted'
                    }`}>
                      <Award className={`h-4 w-4 ${isEarned ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <span className="text-[10px] font-medium leading-tight">
                      {badge.progress}/{badge.target}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Profile & Settings Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-3"
        >
          <Button variant="outline" asChild>
            <Link to="/profile">
              <Camera className="h-4 w-4 mr-2" />
              Profiel bewerken
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/account">
              Account instellingen
            </Link>
          </Button>
        </motion.div>
      </div>
    </Layout>
  );
}
