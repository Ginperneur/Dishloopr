import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Trophy, Clock, Star, MessageSquare, ThumbsUp, RefreshCw } from 'lucide-react';

interface TopReviewer {
  id: string;
  name: string;
  email: string;
  total_reviews: number;
  helpful_votes: number;
  reviewer_level: string;
  created_at: string;
}

interface InactiveUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
  last_review_at: string | null;
  total_reviews: number;
  days_inactive: number;
}

export function UserInsights() {
  const [loading, setLoading] = useState(true);
  const [topReviewers, setTopReviewers] = useState<TopReviewer[]>([]);
  const [inactiveUsers, setInactiveUsers] = useState<InactiveUser[]>([]);
  const [stats, setStats] = useState({ total: 0, activeThisMonth: 0, neverReviewed: 0, avgReviews: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [
      { data: profiles },
      { data: recentReviewers },
      { data: latestReviews },
      { count: totalUsers },
    ] = await Promise.all([
      supabase.from('profiles').select('id, name, email, total_reviews, helpful_votes, reviewer_level, created_at').order('total_reviews', { ascending: false }).limit(500),
      supabase.from('reviews').select('user_id').gte('created_at', oneMonthAgo.toISOString()),
      supabase.from('reviews').select('user_id, created_at').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
    ]);

    const allProfiles = profiles || [];
    const activeUserIds = new Set((recentReviewers || []).map((r: any) => r.user_id));

    // Top reviewers
    const top = allProfiles
      .filter((p: any) => (p.total_reviews || 0) > 0)
      .slice(0, 20)
      .map((p: any) => ({
        id: p.id,
        name: p.name || 'Anoniem',
        email: p.email || '',
        total_reviews: p.total_reviews || 0,
        helpful_votes: p.helpful_votes || 0,
        reviewer_level: p.reviewer_level || 'bronze',
        created_at: p.created_at,
      }));
    setTopReviewers(top);

    // Build last review date map
    const lastReviewMap = new Map<string, string>();
    (latestReviews || []).forEach((r: any) => {
      if (!lastReviewMap.has(r.user_id)) {
        lastReviewMap.set(r.user_id, r.created_at);
      }
    });

    // Inactive users: signed up > 30 days ago, no review in 90 days
    const inactive = allProfiles
      .filter((p: any) => {
        const createdAt = new Date(p.created_at);
        if (createdAt > oneMonthAgo) return false;
        const lastReview = lastReviewMap.get(p.id);
        if (!lastReview) return true;
        return new Date(lastReview) < threeMonthsAgo;
      })
      .map((p: any) => {
        const lastReview = lastReviewMap.get(p.id);
        const lastDate = lastReview ? new Date(lastReview) : new Date(p.created_at);
        return {
          id: p.id,
          name: p.name || 'Anoniem',
          email: p.email || '',
          created_at: p.created_at,
          last_review_at: lastReview || null,
          total_reviews: p.total_reviews || 0,
          days_inactive: Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)),
        };
      })
      .sort((a, b) => b.days_inactive - a.days_inactive);
    setInactiveUsers(inactive);

    const neverReviewed = allProfiles.filter((p: any) => !p.total_reviews || p.total_reviews === 0).length;
    const totalReviews = allProfiles.reduce((sum: number, p: any) => sum + (p.total_reviews || 0), 0);

    setStats({
      total: totalUsers || 0,
      activeThisMonth: activeUserIds.size,
      neverReviewed,
      avgReviews: allProfiles.length > 0 ? Math.round((totalReviews / allProfiles.length) * 10) / 10 : 0,
    });

    setLoading(false);
  };

  const getLevelBadge = (level: string) => {
    const config: Record<string, { label: string; className: string }> = {
      platinum: { label: '💎 Platinum', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
      gold: { label: '🥇 Gold', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      silver: { label: '🥈 Silver', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
      bronze: { label: '🥉 Bronze', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
    };
    const c = config[level] || config.bronze;
    return <Badge variant="outline" className={`text-[10px] ${c.className}`}>{c.label}</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Gebruikersdata laden...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Totaal gebruikers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{stats.activeThisMonth}</p>
            <p className="text-xs text-muted-foreground">Actief (30d)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats.neverReviewed}</p>
            <p className="text-xs text-muted-foreground">Nooit gereviewd</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.avgReviews}</p>
            <p className="text-xs text-muted-foreground">Gem. reviews/user</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="top" className="space-y-4">
        <TabsList>
          <TabsTrigger value="top" className="gap-1.5 text-xs">
            <Trophy className="h-3.5 w-3.5" />
            Top Reviewers
          </TabsTrigger>
          <TabsTrigger value="inactive" className="gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" />
            Inactief ({inactiveUsers.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="top">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Top 20 Reviewers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Naam</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Reviews</TableHead>
                    <TableHead>Helpful</TableHead>
                    <TableHead>Lid sinds</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topReviewers.map((u, i) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-bold text-sm">{i + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getLevelBadge(u.reviewer_level)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                          {u.total_reviews}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1 text-sm">
                          <ThumbsUp className="h-3 w-3 text-muted-foreground" />
                          {u.helpful_votes}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString('nl-NL')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inactive">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Inactieve gebruikers (90+ dagen)
              </CardTitle>
              <CardDescription>
                Gebruikers die al lang niet meer actief zijn
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>Reviews</TableHead>
                    <TableHead>Laatste activiteit</TableHead>
                    <TableHead>Dagen inactief</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactiveUsers.slice(0, 50).map(u => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{u.name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{u.total_reviews}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.last_review_at ? new Date(u.last_review_at).toLocaleDateString('nl-NL') : 'Nooit'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.days_inactive > 180 ? 'destructive' : 'outline'} className="text-xs">
                          {u.days_inactive}d
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {inactiveUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground text-sm">
                        Geen inactieve gebruikers gevonden
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {inactiveUsers.length > 50 && (
                <div className="p-3 text-center text-xs text-muted-foreground border-t">
                  Top 50 getoond van {inactiveUsers.length}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
