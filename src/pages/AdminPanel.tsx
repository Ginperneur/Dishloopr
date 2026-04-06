import { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Users, Store, MessageSquare, TrendingUp, MapPin, UtensilsCrossed,
  Shield, Eye, Trash2, Check, X, Search, Sparkles, FileText,
  ChevronLeft, ChevronRight, RefreshCw, Settings, Crown, Upload,
  Image, Globe, Download, ShieldAlert, Zap, Clock, Bell, Menu
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
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
import { GoogleEnrichManager } from '@/components/admin/GoogleEnrichManager';
import { PhotosManager } from '@/components/admin/PhotosManager';
import { RestaurantDishesManager } from '@/components/admin/RestaurantDishesManager';
import { FeaturedSlotsManager } from '@/components/admin/FeaturedSlotsManager';
import { AmbiancePricingManager } from '@/components/admin/AmbiancePricingManager';
import { AdminNotifications } from '@/components/admin/AdminNotifications';
import { NewsletterManager } from '@/components/admin/NewsletterManager';
import { MenuScraper } from '@/components/admin/MenuScraper';
import { DataExportManager } from '@/components/admin/DataExportManager';
import { RestaurantAudit } from '@/components/admin/RestaurantAudit';
import { KpiDashboard } from '@/components/admin/KpiDashboard';
import { BrokenImageChecker } from '@/components/admin/BrokenImageChecker';
import { DuplicateMerger } from '@/components/admin/DuplicateMerger';
import { CompletenessScore } from '@/components/admin/CompletenessScore';
import { RevenueDashboard } from '@/components/admin/RevenueDashboard';
import { UserInsights } from '@/components/admin/UserInsights';
import { SearchAnalytics } from '@/components/admin/SearchAnalytics';
import { GeographicCoverage } from '@/components/admin/GeographicCoverage';
import { SeoHealthMonitor } from '@/components/admin/SeoHealthMonitor';
import { BulkActionsManager } from '@/components/admin/BulkActionsManager';
import { AuditTrail } from '@/components/admin/AuditTrail';
import { ChurnRiskDashboard } from '@/components/admin/ChurnRiskDashboard';
import { ClaimAnalytics } from '@/components/admin/ClaimAnalytics';
import { UserProfileModal } from '@/components/admin/UserProfileModal';
import { ReviewModerationManager } from '@/components/admin/ReviewModerationManager';
import { NotificationManager } from '@/components/admin/NotificationManager';

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

const ITEMS_PER_PAGE = 25;

// Section title mapping
const sectionTitles: Record<string, { title: string; description: string }> = {
  'kpi': { title: "KPI Dashboard", description: "Platform groei en kerncijfers" },
  'revenue': { title: "Omzet Dashboard", description: "MRR, betalingen en top-spenders" },
  'user-insights': { title: "User Insights", description: "Gebruikersactiviteit en retentie" },
  'search-analytics': { title: "Zoek Analytics", description: "Populaire zoekopdrachten en zero results" },
  'geographic': { title: "Geografische Dekking", description: "Restaurantdichtheid per stad" },
  'churn': { title: "Churn Risk", description: "Inactieve eigenaren en retentie" },
  'claim-analytics': { title: "Claim Analyse", description: "Claim funnel en conversie" },
  'restaurants': { title: "Restaurants", description: "Beheer alle restaurants" },
  'dishes': { title: "Gerechten", description: "Gerecht-taxonomie beheren" },
  'dish-approval': { title: "Goedkeuring", description: "Gerechten goedkeuren of afwijzen" },
  'restaurant-dishes': { title: "Bekend Om", description: "Restaurant-gerecht koppelingen" },
  'cities': { title: "Steden", description: "Steden en regio's beheren" },
  'collections': { title: "Collecties", description: "Curated restaurant collecties" },
  'chains': { title: "Ketens", description: "Restaurant ketens beheren" },
  'reviews': { title: "Reviews", description: "Reviews modereren" },
  'users': { title: "Gebruikers", description: "Geregistreerde gebruikers" },
  'roles': { title: "Rollen", description: "Gebruikersrollen toewijzen" },
  'claims': { title: "Claims", description: "Restaurant claims verwerken" },
  'sponsored': { title: "Sponsored", description: "Gesponsorde producten beheren" },
  'featured-slots': { title: "Featured Spots", description: "Featured slots en sfeer-pricing" },
  'newsletter': { title: "Nieuwsbrief", description: "Edities en plaatsingen" },
  'seo': { title: "SEO Pages", description: "City×dish landing pages" },
  'notifications': { title: "Notificaties", description: "E-mail notificatie wachtrij" },
  'audit': { title: "Restaurant Audit", description: "Restaurantgegevens controleren" },
  'broken-images': { title: "Broken Images", description: "Kapotte afbeeldingen opsporen" },
  'duplicates': { title: "Duplicaten", description: "Dubbele restaurants samenvoegen" },
  'completeness': { title: "Completeness", description: "Datakwaliteit per restaurant" },
  'bulk-import': { title: "Bulk Import", description: "CSV restaurants importeren" },
  'menu-scraper': { title: "Menu Scraper", description: "Gerechten van websites scrapen" },
  'geocode': { title: "Geocode", description: "Coördinaten toekennen" },
  'google-enrich': { title: "Google Verrijking", description: "Ratings & openingstijden importeren" },
  'photos': { title: "Foto's", description: "Google-foto's ophalen" },
  'data-export': { title: "Data Export", description: "Data exporteren als CSV" },
  'seo-health': { title: "SEO Health", description: "SEO-problemen monitoren" },
  'bulk-actions': { title: "Bulk Acties", description: "Massale status-updates" },
  'audit-trail': { title: "Audit Trail", description: "Alle admin-acties" },
  'activity': { title: "Activiteit", description: "Activity log" },
  'settings': { title: "Instellingen", description: "Platform configuratie" },
};

export default function AdminPanel() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, totalRestaurants: 0, totalReviews: 0, totalCities: 0,
    totalDishes: 0, pendingReviews: 0, pendingClaims: 0, activeRestaurants: 0
  });
  const [users, setUsers] = useState<any[]>([]);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('kpi');
  
  // Pagination states
  const [restaurantPage, setRestaurantPage] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  
  // Filter states
  const [restaurantStatusFilter, setRestaurantStatusFilter] = useState<string>('all');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('all');

  const handleNavigateToTab = useCallback((tab: string) => {
    setActiveSection(tab);
  }, []);

  // Fetch only stats on mount — heavy data loads lazily per section
  useEffect(() => {
    if (isAdmin) fetchStats();
  }, [isAdmin]);

  // Lazy-load section data only when needed
  useEffect(() => {
    if (!isAdmin) return;
    if (activeSection === 'restaurants' && restaurants.length === 0) fetchRestaurants();
    if (activeSection === 'users' && users.length === 0) fetchUsers();
  }, [activeSection, isAdmin]);

  const fetchStats = async () => {
    const [
      { count: userCount }, { count: restaurantCount }, { count: reviewCount },
      { count: cityCount }, { count: dishCount }, { count: pendingCount },
      { count: newClaimsCount }, { count: legacyClaimsCount }, { count: activeCount }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('restaurants').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true }),
      supabase.from('cities').select('*', { count: 'exact', head: true }),
      supabase.from('dishes').select('*', { count: 'exact', head: true }),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('restaurant_claims').select('*', { count: 'exact', head: true }).in('status', ['pending', 'email_verified', 'phone_verified']),
      supabase.from('claim_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('restaurants').select('*', { count: 'exact', head: true }).eq('is_active', true)
    ]);

    setStats({
      totalUsers: userCount || 0, totalRestaurants: restaurantCount || 0,
      totalReviews: reviewCount || 0, totalCities: cityCount || 0,
      totalDishes: dishCount || 0, pendingReviews: pendingCount || 0,
      pendingClaims: (newClaimsCount || 0) + (legacyClaimsCount || 0),
      activeRestaurants: activeCount || 0
    });
    setLoading(false);
  };

  const fetchRestaurants = async () => {
    let allRestaurants: any[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data: batch } = await supabase.from('restaurants').select('*, cities:city_id (name)').order('created_at', { ascending: false }).range(from, from + batchSize - 1);
      if (!batch || batch.length === 0) break;
      allRestaurants = allRestaurants.concat(batch);
      if (batch.length < batchSize) break;
      from += batchSize;
    }
    setRestaurants(allRestaurants);
  };

  const fetchUsers = async () => {
    const { data: profileData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100);
    setUsers(profileData || []);
  };

  const fetchData = async () => {
    await fetchStats();
    // Reload section-specific data if currently visible
    if (activeSection === 'restaurants') fetchRestaurants();
    if (activeSection === 'users') fetchUsers();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    toast.success('Data vernieuwd');
  };

  const updateRestaurantStatus = async (id: string, field: string, value: boolean) => {
    const { error } = await supabase.from('restaurants').update({ [field]: value }).eq('id', id);
    if (error) { toast.error('Update mislukt'); } else {
      toast.success('Restaurant bijgewerkt');
      setRestaurants(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    }
  };

  const deleteRestaurant = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit restaurant wilt verwijderen?')) return;
    const { error } = await supabase.from('restaurants').delete().eq('id', id);
    if (error) { toast.error('Verwijderen mislukt: ' + error.message); } else {
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
    if (restaurantStatusFilter === 'active') result = result.filter(r => r.is_active);
    else if (restaurantStatusFilter === 'inactive') result = result.filter(r => !r.is_active);
    else if (restaurantStatusFilter === 'featured') result = result.filter(r => r.is_featured);
    else if (restaurantStatusFilter === 'claimed') result = result.filter(r => r.claimed_by_owner_id);
    return result;
  }, [restaurants, searchQuery, restaurantStatusFilter]);

  const paginatedRestaurants = useMemo(() => {
    const start = (restaurantPage - 1) * ITEMS_PER_PAGE;
    return filteredRestaurants.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRestaurants, restaurantPage]);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * ITEMS_PER_PAGE;
    return users.slice(start, start + ITEMS_PER_PAGE);
  }, [users, userPage]);

  const totalRestaurantPages = Math.ceil(filteredRestaurants.length / ITEMS_PER_PAGE);
  const totalUserPages = Math.ceil(users.length / ITEMS_PER_PAGE);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-md">
          <div className="h-8 w-64 bg-muted rounded mx-auto" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Toegang geweigerd</h1>
          <p className="text-muted-foreground">Je hebt geen toegang tot het admin panel.</p>
        </div>
      </div>
    );
  }

  const currentSection = sectionTitles[activeSection] || { title: activeSection, description: '' };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          pendingReviews={stats.pendingReviews}
          pendingClaims={stats.pendingClaims}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-14 border-b border-border/50 bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-8 w-8" />
              <div className="hidden sm:block">
                <h1 className="text-sm font-semibold leading-tight">{currentSection.title}</h1>
                <p className="text-[11px] text-muted-foreground leading-tight">{currentSection.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Quick stats in top bar */}
              <div className="hidden md:flex items-center gap-4 mr-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Store className="h-3.5 w-3.5" />
                  {stats.totalRestaurants}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {stats.totalUsers}
                </span>
                <span className="flex items-center gap-1">
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                  {stats.totalDishes}
                </span>
                {stats.pendingClaims > 0 && (
                  <Badge variant="destructive" className="text-[10px] h-5">
                    {stats.pendingClaims} claims
                  </Badge>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Vernieuwen</span>
              </Button>
            </div>
          </header>

          {/* Content area */}
          <main className="flex-1 overflow-auto">
            <div className="p-4 md:p-6 max-w-[1400px]">
              {/* Notifications banner */}
              {activeSection === 'kpi' && (stats.pendingClaims > 0 || stats.pendingReviews > 0) && (
                <div className="mb-6">
                  <AdminNotifications onNavigate={handleNavigateToTab} />
                </div>
              )}

              {/* Section content */}
              {activeSection === 'kpi' && <KpiDashboard />}
              {activeSection === 'revenue' && <RevenueDashboard />}
              {activeSection === 'user-insights' && <UserInsights />}
              {activeSection === 'search-analytics' && <SearchAnalytics />}
              {activeSection === 'geographic' && <GeographicCoverage />}
              {activeSection === 'churn' && <ChurnRiskDashboard />}
              {activeSection === 'claim-analytics' && <ClaimAnalytics />}
              
              {activeSection === 'restaurants' && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <CardDescription>{filteredRestaurants.length} restaurants gevonden</CardDescription>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative w-48">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Zoek..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setRestaurantPage(1); }} className="pl-9 h-9" />
                        </div>
                        <Select value={restaurantStatusFilter} onValueChange={(v) => { setRestaurantStatusFilter(v); setRestaurantPage(1); }}>
                          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
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
                              <TableRow key={i}><TableCell colSpan={7}><div className="h-10 bg-muted rounded animate-pulse" /></TableCell></TableRow>
                            ))
                          ) : paginatedRestaurants.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Geen restaurants gevonden</TableCell></TableRow>
                          ) : (
                            paginatedRestaurants.map(restaurant => (
                              <TableRow key={restaurant.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedRestaurant(restaurant); setDetailModalOpen(true); }}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {restaurant.name}
                                    {restaurant.claimed_by_owner_id && <Badge variant="outline" className="text-[10px] px-1"><Check className="h-3 w-3" /></Badge>}
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">{restaurant.cities?.name || '-'}</TableCell>
                                <TableCell className="text-center">{Number(restaurant.rating).toFixed(1)}</TableCell>
                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                  <Badge variant={restaurant.is_active ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => updateRestaurantStatus(restaurant.id, 'is_active', !restaurant.is_active)}>
                                    {restaurant.is_active ? 'Actief' : 'Inactief'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                  <Button variant={restaurant.is_featured ? 'default' : 'ghost'} size="sm" className="h-7 w-7 p-0" onClick={() => updateRestaurantStatus(restaurant.id, 'is_featured', !restaurant.is_featured)}>
                                    <Sparkles className={`h-4 w-4 ${restaurant.is_featured ? '' : 'text-muted-foreground'}`} />
                                  </Button>
                                </TableCell>
                                <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                  <Button variant={restaurant.is_top_listing ? 'default' : 'ghost'} size="sm" className="h-7 w-7 p-0" onClick={() => updateRestaurantStatus(restaurant.id, 'is_top_listing', !restaurant.is_top_listing)}>
                                    <TrendingUp className={`h-4 w-4 ${restaurant.is_top_listing ? '' : 'text-muted-foreground'}`} />
                                  </Button>
                                </TableCell>
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteRestaurant(restaurant.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {totalRestaurantPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground">Pagina {restaurantPage} van {totalRestaurantPages}</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setRestaurantPage(p => Math.max(1, p - 1))} disabled={restaurantPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => setRestaurantPage(p => Math.min(totalRestaurantPages, p + 1))} disabled={restaurantPage === totalRestaurantPages}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {activeSection === 'dishes' && <DishesManager onUpdate={fetchData} />}
              {activeSection === 'dish-approval' && <DishApprovalManager />}
              {activeSection === 'restaurant-dishes' && <RestaurantDishesManager />}
              {activeSection === 'cities' && <CitiesManager onUpdate={fetchData} />}
              {activeSection === 'collections' && <CollectionsManager />}
              {activeSection === 'chains' && <ChainsManager />}
              
              {activeSection === 'claims' && (
                <Tabs defaultValue="requests" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="requests">Claim Requests</TabsTrigger>
                    <TabsTrigger value="verification">Verificatie Beheer</TabsTrigger>
                  </TabsList>
                  <TabsContent value="requests"><ClaimRequestsQueue onUpdate={fetchData} /></TabsContent>
                  <TabsContent value="verification"><ClaimsVerificationManager /></TabsContent>
                </Tabs>
              )}

              {activeSection === 'sponsored' && <SponsoredProductsManager />}
              {activeSection === 'featured-slots' && (
                <div className="space-y-6">
                  <FeaturedSlotsManager />
                  <AmbiancePricingManager />
                </div>
              )}
              {activeSection === 'reviews' && <ReviewModerationManager />}
              
              {activeSection === 'users' && (
                <Card>
                  <CardHeader>
                    <CardDescription>{users.length} geregistreerde gebruikers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Naam</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead className="text-center">Reviews</TableHead>
                          <TableHead className="text-center">Helpful</TableHead>
                          <TableHead className="text-center">Level</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Aangemaakt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedUsers.map(u => {
                          const level = u.reviewer_level || 'bronze';
                          const levelColors: Record<string, string> = {
                            bronze: 'bg-amber-700/10 text-amber-700 border-amber-700/30',
                            silver: 'bg-slate-400/10 text-slate-500 border-slate-400/30',
                            gold: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
                            platinum: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
                          };
                          const daysSinceUpdate = Math.floor((Date.now() - new Date(u.updated_at || u.created_at).getTime()) / (1000 * 60 * 60 * 24));
                          const isActive = daysSinceUpdate < 90;
                          const initials = (u.name || u.email || '?').slice(0, 2).toUpperCase();
                          return (
                            <TableRow key={u.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedUser(u); setUserModalOpen(true); }}>
                              <TableCell>
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
                                  {u.avatar_url ? <img src={u.avatar_url} alt="" className="h-full w-full object-cover" /> : initials}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">{u.name || '(Geen naam)'}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                              <TableCell className="text-center font-medium">{u.total_reviews || 0}</TableCell>
                              <TableCell className="text-center text-sm">{u.helpful_votes || 0}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`${levelColors[level] || levelColors.bronze} border capitalize text-[10px]`}>{level}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <div className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                                  <span className="text-xs text-muted-foreground">{isActive ? 'Actief' : 'Inactief'}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{new Date(u.created_at).toLocaleDateString('nl-NL')}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    {totalUserPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground">Pagina {userPage} van {totalUserPages}</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                          <Button variant="outline" size="sm" onClick={() => setUserPage(p => Math.min(totalUserPages, p + 1))} disabled={userPage === totalUserPages}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {activeSection === 'roles' && <UserRolesManager users={users} onUpdate={fetchData} />}
              {activeSection === 'activity' && (
                <Card>
                  <CardContent className="pt-6"><ActivityLog /></CardContent>
                </Card>
              )}
              {activeSection === 'settings' && (
                <Card>
                  <CardContent className="pt-6"><SettingsManager /></CardContent>
                </Card>
              )}
              {activeSection === 'notifications' && <NotificationManager />}
              {activeSection === 'seo' && (
                <Card>
                  <CardContent className="pt-6"><SeoLandingPagesManager /></CardContent>
                </Card>
              )}
              {activeSection === 'newsletter' && (
                <Card>
                  <CardContent className="pt-6"><NewsletterManager /></CardContent>
                </Card>
              )}
              {activeSection === 'menu-scraper' && <MenuScraper />}
              {activeSection === 'data-export' && <DataExportManager />}
              {activeSection === 'bulk-import' && <BulkRestaurantUpload onSuccess={fetchData} />}
              {activeSection === 'audit' && <RestaurantAudit />}
              {activeSection === 'broken-images' && <BrokenImageChecker />}
              {activeSection === 'duplicates' && <DuplicateMerger />}
              {activeSection === 'completeness' && <CompletenessScore />}
              {activeSection === 'geocode' && <GeocodeManager />}
              {activeSection === 'photos' && <PhotosManager />}
              {activeSection === 'seo-health' && <SeoHealthMonitor />}
              {activeSection === 'bulk-actions' && <BulkActionsManager />}
              {activeSection === 'audit-trail' && <AuditTrail />}
            </div>
          </main>
        </div>
      </div>

      <RestaurantDetailModal restaurant={selectedRestaurant} open={detailModalOpen} onOpenChange={setDetailModalOpen} onUpdate={fetchData} />
      <UserProfileModal user={selectedUser} open={userModalOpen} onOpenChange={setUserModalOpen} />
    </SidebarProvider>
  );
}
