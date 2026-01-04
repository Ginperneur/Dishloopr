import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, 
  Store, 
  MessageSquare, 
  TrendingUp,
  MapPin,
  UtensilsCrossed,
  Shield,
  Eye,
  Trash2,
  Check,
  X,
  Search
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RestaurantDetailModal } from '@/components/admin/RestaurantDetailModal';
import { AddRestaurantModal } from '@/components/admin/AddRestaurantModal';

interface Stats {
  totalUsers: number;
  totalRestaurants: number;
  totalReviews: number;
  totalCities: number;
  totalDishes: number;
  pendingReviews: number;
}

function StatCard({ title, value, icon: Icon }: { 
  title: string; 
  value: number; 
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPanel() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalRestaurants: 0,
    totalReviews: 0,
    totalCities: 0,
    totalDishes: 0,
    pendingReviews: 0
  });
  const [users, setUsers] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch stats
    const [
      { count: userCount },
      { count: restaurantCount },
      { count: reviewCount },
      { count: cityCount },
      { count: dishCount },
      { count: pendingCount }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('restaurants').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true }),
      supabase.from('cities').select('*', { count: 'exact', head: true }),
      supabase.from('dishes').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    ]);

    setStats({
      totalUsers: userCount || 0,
      totalRestaurants: restaurantCount || 0,
      totalReviews: reviewCount || 0,
      totalCities: cityCount || 0,
      totalDishes: dishCount || 0,
      pendingReviews: pendingCount || 0
    });

    // Fetch users
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setUsers(profileData || []);

    // Fetch restaurants
    const { data: restaurantData } = await supabase
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setRestaurants(restaurantData || []);

    // Fetch reviews (all statuses)
    const { data: reviewData } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setReviews(reviewData || []);

    setLoading(false);
  };

  const updateRestaurantStatus = async (id: string, field: string, value: boolean) => {
    const { error } = await supabase
      .from('restaurants')
      .update({ [field]: value })
      .eq('id', id);

    if (error) {
      toast.error('Update mislukt');
    } else {
      toast.success('Restaurant bijgewerkt');
      fetchData();
    }
  };

  const updateReviewStatus = async (id: string, status: 'published' | 'pending' | 'flagged') => {
    const { error } = await supabase
      .from('reviews')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error('Update mislukt');
    } else {
      toast.success('Review bijgewerkt');
      fetchData();
    }
  };

  const deleteRestaurant = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit restaurant wilt verwijderen?')) return;

    const { error } = await supabase
      .from('restaurants')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Verwijderen mislukt');
    } else {
      toast.success('Restaurant verwijderd');
      fetchData();
    }
  };

  if (authLoading || adminLoading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-muted rounded" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Shield className="h-16 w-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Toegang geweigerd</h1>
          <p className="text-muted-foreground">
            Je hebt geen toegang tot het admin panel.
          </p>
        </div>
      </Layout>
    );
  }

  const filteredRestaurants = restaurants.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="container py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Admin Panel</h1>
          </div>
          <p className="text-muted-foreground">Beheer het Dishloopr platform</p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8"
        >
          <StatCard title="Gebruikers" value={stats.totalUsers} icon={Users} />
          <StatCard title="Restaurants" value={stats.totalRestaurants} icon={Store} />
          <StatCard title="Reviews" value={stats.totalReviews} icon={MessageSquare} />
          <StatCard title="Steden" value={stats.totalCities} icon={MapPin} />
          <StatCard title="Gerechten" value={stats.totalDishes} icon={UtensilsCrossed} />
          <StatCard title="In afwachting" value={stats.pendingReviews} icon={Eye} />
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="restaurants" className="space-y-6">
          <TabsList>
            <TabsTrigger value="restaurants">Restaurants</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="users">Gebruikers</TabsTrigger>
          </TabsList>

          <TabsContent value="restaurants">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Restaurants beheren</CardTitle>
                  <div className="flex items-center gap-4">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Zoek restaurants..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <AddRestaurantModal onSuccess={fetchData} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naam</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Featured</TableHead>
                      <TableHead>Top</TableHead>
                      <TableHead>Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRestaurants.map(restaurant => (
                      <TableRow 
                        key={restaurant.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedRestaurant(restaurant);
                          setDetailModalOpen(true);
                        }}
                      >
                        <TableCell className="font-medium">{restaurant.name}</TableCell>
                        <TableCell>{Number(restaurant.rating).toFixed(1)}</TableCell>
                        <TableCell>
                          <Badge variant={restaurant.is_active ? 'default' : 'secondary'}>
                            {restaurant.is_active ? 'Actief' : 'Inactief'}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant={restaurant.is_featured ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateRestaurantStatus(restaurant.id, 'is_featured', !restaurant.is_featured)}
                          >
                            {restaurant.is_featured ? 'Ja' : 'Nee'}
                          </Button>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant={restaurant.is_top_listing ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => updateRestaurantStatus(restaurant.id, 'is_top_listing', !restaurant.is_top_listing)}
                          >
                            {restaurant.is_top_listing ? 'Ja' : 'Nee'}
                          </Button>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => updateRestaurantStatus(restaurant.id, 'is_active', !restaurant.is_active)}
                            >
                              {restaurant.is_active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => deleteRestaurant(restaurant.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reviews">
            <Card>
              <CardHeader>
                <CardTitle>Review moderatie</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titel</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map(review => (
                      <TableRow key={review.id}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {review.title || '(Geen titel)'}
                        </TableCell>
                        <TableCell>{review.rating}/5</TableCell>
                        <TableCell>
                          <Select
                            value={review.status}
                            onValueChange={(value: 'published' | 'pending' | 'flagged') => updateReviewStatus(review.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="published">Gepubliceerd</SelectItem>
                              <SelectItem value="pending">In afwachting</SelectItem>
                              <SelectItem value="flagged">Gemarkeerd</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {new Date(review.created_at).toLocaleDateString('nl-NL')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-green-600"
                              onClick={() => updateReviewStatus(review.id, 'published')}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              onClick={() => updateReviewStatus(review.id, 'flagged')}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Gebruikers</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naam</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Aangemaakt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name || '(Geen naam)'}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString('nl-NL')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Restaurant Detail Modal */}
        <RestaurantDetailModal
          restaurant={selectedRestaurant}
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          onUpdate={fetchData}
        />
      </div>
    </Layout>
  );
}
