import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Store, Users, MessageSquare, UtensilsCrossed, MapPin, 
  TrendingUp, TrendingDown, Crown, Shield, Eye, Star,
  BarChart3, Activity, RefreshCw, Sparkles
} from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';

interface KpiData {
  totalRestaurants: number;
  activeRestaurants: number;
  totalReviews: number;
  reviewsThisWeek: number;
  reviewsLastWeek: number;
  totalUsers: number;
  usersThisWeek: number;
  usersLastWeek: number;
  totalClaims: number;
  verifiedClaims: number;
  avgCompleteness: number;
  restaurantsWithImages: number;
  restaurantsWithDishes: number;
  restaurantsWithGeo: number;
  restaurantsWithContact: number;
  weeklyTrends: { week: string; restaurants: number; reviews: number; users: number }[];
}

export function KpiDashboard() {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deduping, setDeduping] = useState(false);

  useEffect(() => {
    fetchKpis();
  }, []);

  const handleDedupeAndRefresh = async () => {
    setDeduping(true);
    try {
      const [dishDedup, rdDedup] = await Promise.all([
        supabase.rpc('deduplicate_dishes'),
        supabase.rpc('deduplicate_restaurant_dishes'),
      ]);
      const dishesRemoved = (dishDedup.data as any)?.dishes_removed || 0;
      const dupsRemoved = (rdDedup.data as any)?.duplicates_removed || 0;
      toast.success(`Opgeschoond: ${dishesRemoved} dubbele gerechten, ${dupsRemoved} dubbele koppelingen verwijderd`);
      await fetchKpis();
    } catch (e) {
      toast.error('Fout bij opschonen');
    } finally {
      setDeduping(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchKpis();
    setRefreshing(false);
    toast.success('Data vernieuwd');
  };

  const fetchKpis = async () => {
    setLoading(true);
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      { count: totalRestaurants },
      { count: activeRestaurants },
      { count: totalReviews },
      { count: reviewsThisWeek },
      { count: reviewsLastWeek },
      { count: totalUsers },
      { count: usersThisWeek },
      { count: usersLastWeek },
      { count: totalClaims },
      { count: verifiedClaims },
      { data: allRestaurants },
      { data: weeklyRestaurants },
      { data: weeklyReviews },
      { data: weeklyUsers },
    ] = await Promise.all([
      supabase.from('restaurants').select('*', { count: 'exact', head: true }),
      supabase.from('restaurants').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('reviews').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo.toISOString()),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).gte('created_at', twoWeeksAgo.toISOString()).lt('created_at', oneWeekAgo.toISOString()),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', oneWeekAgo.toISOString()),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', twoWeeksAgo.toISOString()).lt('created_at', oneWeekAgo.toISOString()),
      supabase.from('restaurant_claims').select('*', { count: 'exact', head: true }),
      supabase.from('restaurant_claims').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('restaurants').select('id, images, geo_lat, geo_lng, phone, website_url, cuisines'),
      supabase.from('restaurants').select('created_at').order('created_at', { ascending: true }),
      supabase.from('reviews').select('created_at').order('created_at', { ascending: true }),
      supabase.from('profiles').select('created_at').order('created_at', { ascending: true }),
    ]);

    // Dish counts
    const { data: dishLinks } = await supabase.from('restaurant_dishes').select('restaurant_id').neq('status', 'rejected');
    const restaurantsWithDishesSet = new Set((dishLinks || []).map((d: any) => d.restaurant_id));

    const restaurants = allRestaurants || [];
    const withImages = restaurants.filter((r: any) => r.images && r.images.length > 0).length;
    const withGeo = restaurants.filter((r: any) => r.geo_lat && r.geo_lng).length;
    const withContact = restaurants.filter((r: any) => r.phone || r.website_url).length;
    const withDishes = restaurantsWithDishesSet.size;

    const total = restaurants.length || 1;
    const avgCompleteness = Math.round(
      ((withImages / total + withGeo / total + withContact / total + withDishes / total) / 4) * 100
    );

    // Build weekly trends (last 8 weeks)
    const trends: { week: string; restaurants: number; reviews: number; users: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
      
      const rCount = (weeklyRestaurants || []).filter((r: any) => {
        const d = new Date(r.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      const revCount = (weeklyReviews || []).filter((r: any) => {
        const d = new Date(r.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;
      const uCount = (weeklyUsers || []).filter((r: any) => {
        const d = new Date(r.created_at);
        return d >= weekStart && d < weekEnd;
      }).length;

      trends.push({ week: label, restaurants: rCount, reviews: revCount, users: uCount });
    }

    setData({
      totalRestaurants: totalRestaurants || 0,
      activeRestaurants: activeRestaurants || 0,
      totalReviews: totalReviews || 0,
      reviewsThisWeek: reviewsThisWeek || 0,
      reviewsLastWeek: reviewsLastWeek || 0,
      totalUsers: totalUsers || 0,
      usersThisWeek: usersThisWeek || 0,
      usersLastWeek: usersLastWeek || 0,
      totalClaims: totalClaims || 0,
      verifiedClaims: verifiedClaims || 0,
      avgCompleteness,
      restaurantsWithImages: withImages,
      restaurantsWithDishes: withDishes,
      restaurantsWithGeo: withGeo,
      restaurantsWithContact: withContact,
      weeklyTrends: trends,
    });
    setLoading(false);
  };

  const getTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? { value: 100, isPositive: true } : { value: 0, isPositive: true };
    const change = Math.round(((current - previous) / previous) * 100);
    return { value: Math.abs(change), isPositive: change >= 0 };
  };

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-muted rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  const reviewTrend = getTrend(data.reviewsThisWeek, data.reviewsLastWeek);
  const userTrend = getTrend(data.usersThisWeek, data.usersLastWeek);
  const claimRatio = data.totalClaims > 0 ? Math.round((data.verifiedClaims / data.totalClaims) * 100) : 0;
  const total = data.totalRestaurants || 1;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Store className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="text-[10px]">{data.activeRestaurants} actief</Badge>
            </div>
            <p className="text-2xl font-bold">{data.totalRestaurants}</p>
            <p className="text-xs text-muted-foreground">Restaurants totaal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className={`text-xs font-medium flex items-center gap-0.5 ${reviewTrend.isPositive ? 'text-emerald-600' : 'text-destructive'}`}>
                {reviewTrend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {reviewTrend.value}%
              </span>
            </div>
            <p className="text-2xl font-bold">{data.reviewsThisWeek}</p>
            <p className="text-xs text-muted-foreground">Reviews deze week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className={`text-xs font-medium flex items-center gap-0.5 ${userTrend.isPositive ? 'text-emerald-600' : 'text-destructive'}`}>
                {userTrend.isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {userTrend.value}%
              </span>
            </div>
            <p className="text-2xl font-bold">{data.usersThisWeek}</p>
            <p className="text-xs text-muted-foreground">Nieuwe gebruikers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="text-[10px]">{claimRatio}%</Badge>
            </div>
            <p className="text-2xl font-bold">{data.verifiedClaims}/{data.totalClaims}</p>
            <p className="text-xs text-muted-foreground">Claim conversie</p>
          </CardContent>
        </Card>
      </div>

      {/* Growth Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Groeitrends (laatste 8 weken)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.weeklyTrends}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="week" className="text-xs" tick={{ fontSize: 11 }} />
                <YAxis className="text-xs" tick={{ fontSize: 11 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }} 
                />
                <Area type="monotone" dataKey="restaurants" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.3)" name="Restaurants" />
                <Area type="monotone" dataKey="reviews" stackId="2" stroke="hsl(var(--accent-foreground))" fill="hsl(var(--accent) / 0.3)" name="Reviews" />
                <Area type="monotone" dataKey="users" stackId="3" stroke="#10b981" fill="rgba(16, 185, 129, 0.2)" name="Gebruikers" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Data Quality */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Datakwaliteit — gemiddeld {data.avgCompleteness}% compleet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Met foto\'s', value: data.restaurantsWithImages, icon: '📷' },
            { label: 'Met gerechten', value: data.restaurantsWithDishes, icon: '🍽️' },
            { label: 'Met coördinaten', value: data.restaurantsWithGeo, icon: '📍' },
            { label: 'Met contactinfo', value: data.restaurantsWithContact, icon: '📞' },
          ].map(item => {
            const pct = Math.round((item.value / total) * 100);
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{item.icon} {item.label}</span>
                  <span className="text-muted-foreground">{item.value}/{data.totalRestaurants} ({pct}%)</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
