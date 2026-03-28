import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { CheckCircle, XCircle, AlertTriangle, Eye, Search, Star, RefreshCw } from 'lucide-react';

interface ReviewWithDetails {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: string;
  created_at: string;
  user_id: string;
  restaurant_id: string;
  photos: string[] | null;
  is_verified: boolean | null;
  profile?: { name: string | null; email: string | null };
  restaurant?: { name: string; slug: string };
}

export function ReviewModerationManager() {
  const [reviews, setReviews] = useState<ReviewWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReviews = async () => {
    setLoading(true);
    let query = supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter as 'published' | 'pending' | 'flagged');
    }

    const { data, error } = await query;
    if (error) {
      toast.error('Fout bij ophalen reviews');
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(r => r.user_id))];
      const restaurantIds = [...new Set(data.map(r => r.restaurant_id))];

      const [profilesRes, restaurantsRes] = await Promise.all([
        supabase.from('profiles').select('id, name, email').in('id', userIds),
        supabase.from('restaurants').select('id, name, slug').in('id', restaurantIds),
      ]);

      const profileMap = new Map(profilesRes.data?.map(p => [p.id, p]) || []);
      const restaurantMap = new Map(restaurantsRes.data?.map(r => [r.id, r]) || []);

      setReviews(data.map(r => ({
        ...r,
        profile: profileMap.get(r.user_id) as any,
        restaurant: restaurantMap.get(r.restaurant_id) as any,
      })));
    } else {
      setReviews([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchReviews(); }, [statusFilter]);

  const updateStatus = async (reviewId: string, newStatus: string) => {
    const { error } = await supabase
      .from('reviews')
      .update({ status: newStatus as 'published' | 'pending' | 'flagged' })
      .eq('id', reviewId);

    if (error) {
      toast.error('Fout bij bijwerken status');
      return;
    }
    toast.success(`Review ${newStatus === 'published' ? 'goedgekeurd' : newStatus === 'flagged' ? 'gemarkeerd' : 'bijgewerkt'}`);
    fetchReviews();
  };

  const filteredReviews = reviews.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.title?.toLowerCase().includes(q) ||
      r.body?.toLowerCase().includes(q) ||
      r.profile?.name?.toLowerCase().includes(q) ||
      r.restaurant?.name?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: reviews.length,
    published: reviews.filter(r => r.status === 'published').length,
    pending: reviews.filter(r => r.status === 'pending').length,
    flagged: reviews.filter(r => r.status === 'flagged').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Totaal</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.published}</p>
            <p className="text-xs text-muted-foreground">Gepubliceerd</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-accent-foreground">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">In afwachting</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.flagged}</p>
            <p className="text-xs text-muted-foreground">Gemarkeerd</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op review, gebruiker of restaurant..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            <SelectItem value="published">Gepubliceerd</SelectItem>
            <SelectItem value="pending">In afwachting</SelectItem>
            <SelectItem value="flagged">Gemarkeerd</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchReviews}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Review List */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Laden...</div>
      ) : filteredReviews.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Geen reviews gevonden</div>
      ) : (
        <div className="space-y-3">
          {filteredReviews.map(review => (
            <Card key={review.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-sm">{review.profile?.name || 'Anoniem'}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="font-medium text-sm text-primary truncate">{review.restaurant?.name || 'Onbekend'}</span>
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < review.rating ? 'fill-rating text-rating' : 'text-muted'}`} />
                        ))}
                      </div>
                      <Badge variant={
                        review.status === 'published' ? 'default' :
                        review.status === 'pending' ? 'secondary' : 'destructive'
                      } className="text-xs">
                        {review.status === 'published' ? 'Gepubliceerd' :
                         review.status === 'pending' ? 'In afwachting' : 'Gemarkeerd'}
                      </Badge>
                    </div>
                    {review.title && <p className="font-semibold text-sm">{review.title}</p>}
                    {review.body && <p className="text-sm text-muted-foreground line-clamp-2">{review.body}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(review.created_at).toLocaleDateString('nl-NL')}
                      {review.profile?.email && ` • ${review.profile.email}`}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {review.status !== 'published' && (
                      <Button size="sm" variant="outline" className="text-primary h-8" onClick={() => updateStatus(review.id, 'published')}>
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {review.status !== 'flagged' && (
                      <Button size="sm" variant="outline" className="text-destructive h-8" onClick={() => updateStatus(review.id, 'flagged')}>
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                    {review.status !== 'pending' && (
                      <Button size="sm" variant="outline" className="text-muted-foreground h-8" onClick={() => updateStatus(review.id, 'pending')}>
                        <AlertTriangle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
