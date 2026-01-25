import { useState, useEffect, useMemo } from 'react';
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
  Search,
  Sparkles,
  FileText,
  Upload,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Settings,
  Crown,
  AlertCircle,
  Image
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { SponsoredProductsManager } from '@/components/admin/SponsoredProductsManager';
import { BulkRestaurantUpload } from '@/components/admin/BulkRestaurantUpload';
import { ClaimRequestsQueue } from '@/components/admin/ClaimRequestsQueue';
import { ClaimsVerificationManager } from '@/components/admin/ClaimsVerificationManager';
import { DishesManager } from '@/components/admin/DishesManager';
import { CitiesManager } from '@/components/admin/CitiesManager';
import { UserRolesManager } from '@/components/admin/UserRolesManager';
import { ActivityLog } from '@/components/admin/ActivityLog';
import { SettingsManager } from '@/components/admin/SettingsManager';
import { CollectionsManager } from '@/components/admin/CollectionsManager';
import { SeoLandingPagesManager } from '@/components/admin/SeoLandingPagesManager';
import { DishApprovalManager } from '@/components/admin/DishApprovalManager';
import { ChainsManager } from '@/components/admin/ChainsManager';
import { GeocodeManager } from '@/components/admin/GeocodeManager';
import { PhotosManager } from '@/components/admin/PhotosManager';
import { RestaurantDishesManager } from '@/components/admin/RestaurantDishesManager';
import { FeaturedSlotsManager } from '@/components/admin/FeaturedSlotsManager';
import { useActivityLog } from '@/hooks/useActivityLog';

interface Stats {
  totalUsers: number;
  totalRestaurants: number;
  totalReviews: number;
  totalCities: number;
  totalDishes: number;
  pendingReviews: number;
  pendingClaims: number;
  activeRestaurants: number;
}

function StatCard({ 
  title, 
  value, 
  icon: Icon,
  trend,
  alert
}: { 
  title: string; 
  value: number; 
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  alert?: boolean;
}) {
  return (
    <Card className={alert ? 'border-orange-500/50' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            {trend && (
              <p className={`text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.isPositive ? '+' : ''}{trend.value}% vs vorige week
              </p>
            )}
          </div>
          <div className={`h-10 w-10 rounded-full ${alert ? 'bg-orange-500/10' : 'bg-primary/10'} flex items-center justify-center`}>
            <Icon className={`h-5 w-5 ${alert ? 'text-orange-500' : 'text-primary'}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ITEMS_PER_PAGE = 25;

export default function AdminPanel() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalRestaurants: 0,
    totalReviews: 0,
    totalCities: 0,
    totalDishes: 0,
    pendingReviews: 0,
    pendingClaims: 0,
    activeRestaurants: 0
  });
  const [users, setUsers] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  
  // Pagination states
  const [restaurantPage, setRestaurantPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  
  // Filter states
  const [restaurantStatusFilter, setRestaurantStatusFilter] = useState<string>('all');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('all');

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
      { count: pendingCount },
      { count: claimsCount },
      { count: activeCount }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('restaurants').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true }),
      supabase.from('cities').select('*', { count: 'exact', head: true }),
      supabase.from('dishes').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('claim_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('restaurants').select('*', { count: 'exact', head: true }).eq('is_active', true)
    ]);

    setStats({
      totalUsers: userCount || 0,
      totalRestaurants: restaurantCount || 0,
      totalReviews: reviewCount || 0,
      totalCities: cityCount || 0,
      totalDishes: dishCount || 0,
      pendingReviews: pendingCount || 0,
      pendingClaims: claimsCount || 0,
      activeRestaurants: activeCount || 0
    });

    // Fetch users with roles
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setUsers(profileData || []);

    // Fetch restaurants with city info
    const { data: restaurantData } = await supabase
      .from('restaurants')
      .select(`
        *,
        cities:city_id (name)
      `)
      .order('created_at', { ascending: false })
      .limit(200);
    setRestaurants(restaurantData || []);

    // Fetch reviews with restaurant info
    const { data: reviewData } = await supabase
      .from('reviews')
      .select(`
        *,
        restaurants:restaurant_id (name, slug)
      `)
      .order('created_at', { ascending: false })
      .limit(100);
    setReviews(reviewData || []);

    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success('Data vernieuwd');
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
      // Update local state
      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
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
      // Update local state
      setReviews(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      // Update stats
      if (status !== 'pending') {
        setStats(prev => ({ ...prev, pendingReviews: prev.pendingReviews - 1 }));
      }
    }
  };

  const deleteRestaurant = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit restaurant wilt verwijderen? Dit kan niet ongedaan worden.')) return;

    const { error } = await supabase
      .from('restaurants')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Verwijderen mislukt: ' + error.message);
    } else {
      toast.success('Restaurant verwijderd');
      setRestaurants(prev => prev.filter(r => r.id !== id));
      setStats(prev => ({ ...prev, totalRestaurants: prev.totalRestaurants - 1 }));
    }
  };

  // Filtered and paginated data
  const filteredRestaurants = useMemo(() => {
    let result = restaurants.filter(r => 
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.address?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (restaurantStatusFilter === 'active') {
      result = result.filter(r => r.is_active);
    } else if (restaurantStatusFilter === 'inactive') {
      result = result.filter(r => !r.is_active);
    } else if (restaurantStatusFilter === 'featured') {
      result = result.filter(r => r.is_featured);
    } else if (restaurantStatusFilter === 'claimed') {
      result = result.filter(r => r.claimed_by_owner_id);
    }
    
    return result;
  }, [restaurants, searchQuery, restaurantStatusFilter]);

  const paginatedRestaurants = useMemo(() => {
    const start = (restaurantPage - 1) * ITEMS_PER_PAGE;
    return filteredRestaurants.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRestaurants, restaurantPage]);

  const filteredReviews = useMemo(() => {
    let result = reviews;
    if (reviewStatusFilter !== 'all') {
      result = result.filter(r => r.status === reviewStatusFilter);
    }
    return result;
  }, [reviews, reviewStatusFilter]);

  const paginatedReviews = useMemo(() => {
    const start = (reviewPage - 1) * ITEMS_PER_PAGE;
    return filteredReviews.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredReviews, reviewPage]);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * ITEMS_PER_PAGE;
    return users.slice(start, start + ITEMS_PER_PAGE);
  }, [users, userPage]);

  const totalRestaurantPages = Math.ceil(filteredRestaurants.length / ITEMS_PER_PAGE);
  const totalReviewPages = Math.ceil(filteredReviews.length / ITEMS_PER_PAGE);
  const totalUserPages = Math.ceil(users.length / ITEMS_PER_PAGE);

  if (authLoading || adminLoading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-muted rounded" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-muted rounded-lg" />
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

  return (
    <Layout>
      <div className="container py-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Admin Panel</h1>
                <p className="text-sm text-muted-foreground">Beheer het Dishloopr platform</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Vernieuwen
            </Button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6"
        >
          <StatCard title="Gebruikers" value={stats.totalUsers} icon={Users} />
          <StatCard title="Restaurants" value={stats.totalRestaurants} icon={Store} />
          <StatCard title="Actief" value={stats.activeRestaurants} icon={Check} />
          <StatCard title="Reviews" value={stats.totalReviews} icon={MessageSquare} />
          <StatCard title="Steden" value={stats.totalCities} icon={MapPin} />
          <StatCard title="Gerechten" value={stats.totalDishes} icon={UtensilsCrossed} />
          <StatCard 
            title="Wachtend" 
            value={stats.pendingReviews} 
            icon={Eye} 
            alert={stats.pendingReviews > 0}
          />
          <StatCard 
            title="Claims" 
            value={stats.pendingClaims} 
            icon={FileText} 
            alert={stats.pendingClaims > 0}
          />
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="restaurants" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1">
            <TabsTrigger value="restaurants" className="gap-1.5">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Restaurants</span>
            </TabsTrigger>
            <TabsTrigger value="dishes" className="gap-1.5">
              <UtensilsCrossed className="h-4 w-4" />
              <span className="hidden sm:inline">Gerechten</span>
            </TabsTrigger>
            <TabsTrigger value="dish-approval" className="gap-1.5">
              <Check className="h-4 w-4" />
              <span className="hidden sm:inline">Dish Approval</span>
            </TabsTrigger>
            <TabsTrigger value="restaurant-dishes" className="gap-1.5">
              <UtensilsCrossed className="h-4 w-4" />
              <span className="hidden sm:inline">Bekend Om</span>
            </TabsTrigger>
            <TabsTrigger value="cities" className="gap-1.5">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Steden</span>
            </TabsTrigger>
            <TabsTrigger value="collections" className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Collecties</span>
            </TabsTrigger>
            <TabsTrigger value="bulk-import" className="gap-1.5">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </TabsTrigger>
            <TabsTrigger value="claims" className="gap-1.5 relative">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Claims</span>
              {stats.pendingClaims > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                  {stats.pendingClaims}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sponsored" className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Sponsored</span>
            </TabsTrigger>
            <TabsTrigger value="featured-slots" className="gap-1.5">
              <Crown className="h-4 w-4" />
              <span className="hidden sm:inline">Featured</span>
            </TabsTrigger>
            <TabsTrigger value="reviews" className="gap-1.5 relative">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Reviews</span>
              {stats.pendingReviews > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center">
                  {stats.pendingReviews}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Gebruikers</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-1.5">
              <Crown className="h-4 w-4" />
              <span className="hidden sm:inline">Rollen</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="gap-1.5">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Activiteit</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Instellingen</span>
            </TabsTrigger>
            <TabsTrigger value="seo" className="gap-1.5">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">SEO Pages</span>
            </TabsTrigger>
            <TabsTrigger value="chains" className="gap-1.5">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Ketens</span>
            </TabsTrigger>
            <TabsTrigger value="geocode" className="gap-1.5">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Geocode</span>
            </TabsTrigger>
            <TabsTrigger value="photos" className="gap-1.5">
              <Image className="h-4 w-4" />
              <span className="hidden sm:inline">Foto's</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="restaurants">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Restaurants beheren</CardTitle>
                    <CardDescription>{filteredRestaurants.length} restaurants gevonden</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-48">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Zoek..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setRestaurantPage(1);
                        }}
                        className="pl-9 h-9"
                      />
                    </div>
                    <Select value={restaurantStatusFilter} onValueChange={(v) => { setRestaurantStatusFilter(v); setRestaurantPage(1); }}>
                      <SelectTrigger className="w-32 h-9">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle</SelectItem>
                        <SelectItem value="active">Actief</SelectItem>
                        <SelectItem value="inactive">Inactief</SelectItem>
                        <SelectItem value="featured">Featured</SelectItem>
                        <SelectItem value="claimed">Geclaimd</SelectItem>
                      </SelectContent>
                    </Select>
                    <AddRestaurantModal onSuccess={fetchData} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naam</TableHead>
                        <TableHead>Stad</TableHead>
                        <TableHead className="text-center">Rating</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-center">Featured</TableHead>
                        <TableHead className="text-center">Top</TableHead>
                        <TableHead className="text-right">Acties</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        [...Array(5)].map((_, i) => (
                          <TableRow key={i}>
                            <TableCell colSpan={7}>
                              <div className="h-10 bg-muted rounded animate-pulse" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : paginatedRestaurants.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Geen restaurants gevonden
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedRestaurants.map(restaurant => (
                          <TableRow 
                            key={restaurant.id} 
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              setSelectedRestaurant(restaurant);
                              setDetailModalOpen(true);
                            }}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {restaurant.name}
                                {restaurant.claimed_by_owner_id && (
                                  <Badge variant="outline" className="text-[10px] px-1">
                                    <Check className="h-3 w-3" />
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {restaurant.cities?.name || '-'}
                            </TableCell>
                            <TableCell className="text-center">{Number(restaurant.rating).toFixed(1)}</TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Badge 
                                variant={restaurant.is_active ? 'default' : 'secondary'}
                                className="cursor-pointer"
                                onClick={() => updateRestaurantStatus(restaurant.id, 'is_active', !restaurant.is_active)}
                              >
                                {restaurant.is_active ? 'Actief' : 'Inactief'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant={restaurant.is_featured ? 'default' : 'ghost'}
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => updateRestaurantStatus(restaurant.id, 'is_featured', !restaurant.is_featured)}
                              >
                                <Sparkles className={`h-4 w-4 ${restaurant.is_featured ? '' : 'text-muted-foreground'}`} />
                              </Button>
                            </TableCell>
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant={restaurant.is_top_listing ? 'default' : 'ghost'}
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => updateRestaurantStatus(restaurant.id, 'is_top_listing', !restaurant.is_top_listing)}
                              >
                                <TrendingUp className={`h-4 w-4 ${restaurant.is_top_listing ? '' : 'text-muted-foreground'}`} />
                              </Button>
                            </TableCell>
                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => deleteRestaurant(restaurant.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Pagination */}
                {totalRestaurantPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Pagina {restaurantPage} van {totalRestaurantPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRestaurantPage(p => Math.max(1, p - 1))}
                        disabled={restaurantPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRestaurantPage(p => Math.min(totalRestaurantPages, p + 1))}
                        disabled={restaurantPage === totalRestaurantPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dishes">
            <DishesManager onUpdate={fetchData} />
          </TabsContent>

          <TabsContent value="dish-approval">
            <DishApprovalManager />
          </TabsContent>

          <TabsContent value="restaurant-dishes">
            <RestaurantDishesManager />
          </TabsContent>

          <TabsContent value="cities">
            <CitiesManager onUpdate={fetchData} />
          </TabsContent>

          <TabsContent value="collections">
            <CollectionsManager />
          </TabsContent>

          <TabsContent value="bulk-import">
            <BulkRestaurantUpload onSuccess={fetchData} />
          </TabsContent>

          <TabsContent value="claims">
            <Tabs defaultValue="requests" className="space-y-4">
              <TabsList>
                <TabsTrigger value="requests">Claim Requests</TabsTrigger>
                <TabsTrigger value="verification">Verificatie Beheer</TabsTrigger>
              </TabsList>
              <TabsContent value="requests">
                <ClaimRequestsQueue onUpdate={fetchData} />
              </TabsContent>
              <TabsContent value="verification">
                <ClaimsVerificationManager />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="sponsored">
            <SponsoredProductsManager />
          </TabsContent>

          <TabsContent value="featured-slots">
            <FeaturedSlotsManager />
          </TabsContent>

          <TabsContent value="reviews">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Review moderatie</CardTitle>
                    <CardDescription>{filteredReviews.length} reviews</CardDescription>
                  </div>
                  <Select value={reviewStatusFilter} onValueChange={(v) => { setReviewStatusFilter(v); setReviewPage(1); }}>
                    <SelectTrigger className="w-40 h-9">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle statussen</SelectItem>
                      <SelectItem value="published">Gepubliceerd</SelectItem>
                      <SelectItem value="pending">In afwachting</SelectItem>
                      <SelectItem value="flagged">Gemarkeerd</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Restaurant</TableHead>
                      <TableHead>Titel</TableHead>
                      <TableHead className="text-center">Rating</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead className="text-right">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedReviews.map(review => (
                      <TableRow key={review.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {review.restaurants?.name || '-'}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {review.title || '(Geen titel)'}
                        </TableCell>
                        <TableCell className="text-center">{review.rating}/5</TableCell>
                        <TableCell>
                          <Select
                            value={review.status}
                            onValueChange={(value: 'published' | 'pending' | 'flagged') => updateReviewStatus(review.id, value)}
                          >
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="published">Gepubliceerd</SelectItem>
                              <SelectItem value="pending">In afwachting</SelectItem>
                              <SelectItem value="flagged">Gemarkeerd</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(review.created_at).toLocaleDateString('nl-NL')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-green-600"
                              onClick={() => updateReviewStatus(review.id, 'published')}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
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
                
                {/* Pagination */}
                {totalReviewPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Pagina {reviewPage} van {totalReviewPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReviewPage(p => Math.max(1, p - 1))}
                        disabled={reviewPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReviewPage(p => Math.min(totalReviewPages, p + 1))}
                        disabled={reviewPage === totalReviewPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Gebruikers</CardTitle>
                <CardDescription>{users.length} geregistreerde gebruikers</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naam</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="text-center">Reviews</TableHead>
                      <TableHead className="text-center">Level</TableHead>
                      <TableHead>Aangemaakt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers.map(user => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name || '(Geen naam)'}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell className="text-center">{user.total_reviews || 0}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="capitalize">
                            {user.reviewer_level || 'bronze'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(user.created_at).toLocaleDateString('nl-NL')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Pagination */}
                {totalUserPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Pagina {userPage} van {totalUserPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUserPage(p => Math.max(1, p - 1))}
                        disabled={userPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))}
                        disabled={userPage === totalUserPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles">
            <UserRolesManager users={users} onUpdate={fetchData} />
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Activity Log
                </CardTitle>
                <CardDescription>Alle admin acties worden hier bijgehouden</CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityLog />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Platform Instellingen
                </CardTitle>
                <CardDescription>Configureer platform-brede instellingen</CardDescription>
              </CardHeader>
              <CardContent>
                <SettingsManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seo">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  SEO Landing Pages
                </CardTitle>
                <CardDescription>Beheer city×dish SEO landing pages voor betere Google rankings</CardDescription>
              </CardHeader>
              <CardContent>
                <SeoLandingPagesManager />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chains">
            <ChainsManager />
          </TabsContent>

          <TabsContent value="geocode">
            <GeocodeManager />
          </TabsContent>

          <TabsContent value="photos">
            <PhotosManager />
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
