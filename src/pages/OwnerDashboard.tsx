import { useState, useEffect } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Eye, 
  MousePointer, 
  Globe, 
  Phone, 
  Star,
  MessageSquare,
  Store,
  ExternalLink,
  Sparkles,
  Crown,
  Zap,
  Gauge,
  UtensilsCrossed,
  Lock,
  Shield,
  AlertTriangle,
  Check,
  Image,
  Clock,
  TrendingUp,
  BarChart3,
  Megaphone,
  LayoutDashboard,
  FileText,
  ChevronRight,
  Rocket,
  CheckCircle2,
  PartyPopper
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useOwnerDashboard } from '@/hooks/useOwnerDashboard';
import { useRestaurantClaims } from '@/hooks/useRestaurantClaims';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/owner/StatCard';
import { ReviewCard } from '@/components/owner/ReviewCard';
import { AnalyticsTab } from '@/components/owner/AnalyticsTab';
import { PromotionsSection } from '@/components/owner/PromotionsSection';
import { SponsoredMarketplace } from '@/components/sponsored/SponsoredMarketplace';
import { FeaturedMarketplace } from '@/components/featured/FeaturedMarketplace';
import { DemandRoutingSettings } from '@/components/routing/DemandRoutingSettings';
import { OptimizationDashboard } from '@/components/optimization/OptimizationDashboard';
import { DishAnalytics } from '@/components/owner/DishAnalytics';
import { SearchRanking } from '@/components/owner/SearchRanking';
import { ClaimStatusBadge } from '@/components/claims/ClaimStatusBadge';
import { MenuItemsManager } from '@/components/admin/MenuItemsManager';
import { LockedFeatureOverlay } from '@/components/claims/LockedFeatureOverlay';
import { VerificationRequiredDialog } from '@/components/claims/VerificationRequiredDialog';
import { DishConfirmation } from '@/components/owner/DishConfirmation';
import { RestaurantImageUpload } from '@/components/admin/RestaurantImageUpload';
import { ActionCards } from '@/components/owner/ActionCards';
import { ReviewIntelligence } from '@/components/owner/ReviewIntelligence';
import { NeighborhoodAnalysis } from '@/components/owner/NeighborhoodAnalysis';
import { PeakHoursInsight } from '@/components/owner/PeakHoursInsight';
import { PromotionROI } from '@/components/owner/PromotionROI';
import { OwnerEventsManager } from '@/components/owner/OwnerEventsManager';
import { NewsletterPlacement } from '@/components/owner/NewsletterPlacement';
import { QRCodeGenerator } from '@/components/owner/QRCodeGenerator';
import { CompetitorBenchmark } from '@/components/owner/CompetitorBenchmark';
import { DealsManager } from '@/components/owner/DealsManager';
import { useOptimizationInsights } from '@/hooks/useOptimizationInsights';
import { useMarketInsights } from '@/hooks/useMarketInsights';
import { useRestaurantDishes } from '@/hooks/useRestaurantDishes';
import { type ClaimPermissions } from '@/types/claims';

export default function OwnerDashboard() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const {
    restaurants,
    selectedRestaurant,
    setSelectedRestaurant,
    reviews,
    analytics,
    loading,
    respondToReview,
    cityName
  } = useOwnerDashboard();

  const { getPermissions, userClaims, refetch: refreshClaims } = useRestaurantClaims();
  const [permissions, setPermissions] = useState<ClaimPermissions | null>(null);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);

  // Fetch optimization data for action cards
  const { data: optimizationData } = useOptimizationInsights(selectedRestaurant?.id);
  const { dishes: restaurantDishes } = useRestaurantDishes({ restaurantId: selectedRestaurant?.id || '' });
  const { competitors, peakHours, peakDays, promotionROI } = useMarketInsights(
    selectedRestaurant?.id,
    selectedRestaurant?.city_id,
    selectedRestaurant?.cuisines || []
  );

  const unansweredReviews = reviews.filter(r => !r.owner_response).length;
  const suggestedDishCount = restaurantDishes.filter(d => d.status === 'suggested').length;
  const trendingMissingDishes = optimizationData?.suggestions.filter(s => s.type === 'missing_dish').length || 0;

  const activeClaim = selectedRestaurant 
    ? userClaims.find(c => c.restaurant_id === selectedRestaurant.id && !['superseded', 'rejected'].includes(c.status))
    : undefined;
  const activeClaimId = activeClaim?.id;
  const isPendingAdminReview = activeClaim?.status === 'pending_admin_review';

  // Handle verification redirect from Stripe
  useEffect(() => {
    const verification = searchParams.get('verification');
    const claimId = searchParams.get('claimId');
    
    if (verification === 'success' && claimId) {
      refreshClaims?.();
      setTimeout(() => {
        loadPermissions();
        refreshClaims?.();
      }, 2000);
      toast.info('Betaling ontvangen! Je verificatie wordt verwerkt.');
      window.history.replaceState({}, '', '/owner-dashboard');
    } else if (verification === 'cancelled') {
      toast.error('Verificatie betaling geannuleerd.');
      window.history.replaceState({}, '', '/owner-dashboard');
    }

    // Handle newsletter redirect from Stripe
    const newsletter = searchParams.get('newsletter');
    if (newsletter === 'success') {
      toast.success('Betaling ontvangen! Je plaatsing wordt beoordeeld.');
      setActiveTab('marketing');
      window.history.replaceState({}, '', '/owner-dashboard');
    } else if (newsletter === 'cancelled') {
      toast.info('Nieuwsbrief betaling geannuleerd.');
      window.history.replaceState({}, '', '/owner-dashboard');
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedRestaurant) {
      loadPermissions();
    }
  }, [selectedRestaurant]);

  const loadPermissions = async () => {
    if (!selectedRestaurant) return;
    const perms = await getPermissions(selectedRestaurant.id);
    setPermissions(perms);
  };

  // Calculate trend percentages (compare current 15d vs previous 15d)
  const calculateTrend = (currentValue: number): { value: number; label: string } => {
    if (!analytics?.viewsByDay || analytics.viewsByDay.length < 2) {
      return { value: 0, label: 'vs vorige periode' };
    }
    const mid = Math.floor(analytics.viewsByDay.length / 2);
    const firstHalf = analytics.viewsByDay.slice(0, mid).reduce((s, d) => s + d.count, 0);
    const secondHalf = analytics.viewsByDay.slice(mid).reduce((s, d) => s + d.count, 0);
    const change = firstHalf > 0 ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100) : 0;
    return { value: change, label: 'vs vorige 15d' };
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-64 bg-muted rounded" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (restaurants.length === 0) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <Store className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Geen restaurants gevonden</h1>
          <p className="text-muted-foreground mb-6">
            Je hebt nog geen restaurants geclaimd. Claim je restaurant om toegang te krijgen tot het dashboard.
          </p>
          <Button asChild>
            <Link to="/claim">Claim je restaurant</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const isVerified = permissions?.isVerifiedOwner ?? false;

  // Onboarding checklist for new owners
  const onboardingSteps = [
    { 
      id: 'verify', 
      label: 'Verifieer je eigendom', 
      done: isVerified,
      action: () => setVerificationDialogOpen(true),
      tab: undefined
    },
    { 
      id: 'dishes', 
      label: 'Bevestig je gerechten', 
      done: suggestedDishCount === 0 && restaurantDishes.length > 0,
      action: () => setActiveTab('content'),
      tab: 'content'
    },
    { 
      id: 'photos', 
      label: 'Voeg foto\'s toe', 
      done: (selectedRestaurant?.images?.length || 0) >= 3,
      action: () => setActiveTab('content'),
      tab: 'content'
    },
    { 
      id: 'menu', 
      label: 'Upload je menu', 
      done: false, // We don't easily know this, keep as suggestion
      action: () => setActiveTab('content'),
      tab: 'content'
    },
    { 
      id: 'reviews', 
      label: 'Reageer op reviews', 
      done: unansweredReviews === 0 && reviews.length > 0,
      action: () => setActiveTab('overview'),
      tab: 'overview'
    },
  ];

  const completedSteps = onboardingSteps.filter(s => s.done).length;
  const isOnboardingComplete = completedSteps >= 4; // 4 out of 5 is good enough

  return (
    <Layout>
      <div className="container py-6 md:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold mb-1">
                {selectedRestaurant?.name || 'Dashboard'}
              </h1>
              <div className="flex items-center gap-3 flex-wrap">
                <ClaimStatusBadge 
                  status={selectedRestaurant?.claim_status || 'unclaimed'} 
                  size="sm" 
                />
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link to={`/restaurant/${selectedRestaurant?.slug}`}>
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Bekijk pagina
                  </Link>
                </Button>
              </div>
            </div>

            {restaurants.length > 1 && (
              <Select
                value={selectedRestaurant?.id}
                onValueChange={(id) => {
                  const restaurant = restaurants.find(r => r.id === id);
                  if (restaurant) setSelectedRestaurant(restaurant);
                }}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Selecteer restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map(restaurant => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </motion.div>

        {/* Status Banner - Compact */}
        {!isVerified && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            {isPendingAdminReview ? (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-primary text-sm">In afwachting van admin review</p>
                      <p className="text-xs text-muted-foreground">
                        Je betaling is ontvangen. Een admin zal je aanvraag beoordelen.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/contact">Contact</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-accent/30 bg-accent/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-accent-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-accent-foreground text-sm">Beperkte toegang</p>
                      <p className="text-xs text-muted-foreground">
                        Verifieer je eigendom voor volledige dashboard-toegang.
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setVerificationDialogOpen(true)}>
                      <Shield className="h-3 w-3 mr-1" />
                      Verifieer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* Onboarding Quickstart - show for new owners */}
        {!isOnboardingComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6"
          >
            <Card className="border-primary/20">
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Rocket className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Aan de slag met je profiel</p>
                    <p className="text-xs text-muted-foreground">{completedSteps} van {onboardingSteps.length} stappen voltooid</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {Math.round((completedSteps / onboardingSteps.length) * 100)}%
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                  {onboardingSteps.map((step, i) => (
                    <button
                      key={step.id}
                      onClick={step.action}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors text-sm ${
                        step.done 
                          ? 'border-primary/30 bg-primary/5 text-primary' 
                          : 'border-border hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                      )}
                      <span className={`text-xs font-medium ${step.done ? 'line-through opacity-60' : ''}`}>
                        {step.label}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6"
        >
          <StatCard
            title="Profielweergaven"
            value={analytics?.totalViews || 0}
            icon={Eye}
            trend={calculateTrend(analytics?.totalViews || 0)}
          />
          <StatCard
            title="Totale clicks"
            value={analytics?.totalClicks || 0}
            icon={MousePointer}
            trend={calculateTrend(analytics?.totalClicks || 0)}
          />
          <StatCard
            title="Website clicks"
            value={isVerified ? (analytics?.websiteClicks || 0) : 0}
            icon={Globe}
            locked={!isVerified}
          />
          <StatCard
            title="Telefoon clicks"
            value={isVerified ? (analytics?.phoneClicks || 0) : 0}
            icon={Phone}
            locked={!isVerified}
          />
        </motion.div>

        {/* Action Cards */}
        <ActionCards
          unansweredReviews={unansweredReviews}
          suggestedDishes={suggestedDishCount}
          optimizationScore={optimizationData?.overallScore ?? null}
          trendingMissingDishes={trendingMissingDishes}
          onNavigateTab={(tab) => {
            // Map old tab names to new grouped tabs
            const tabMap: Record<string, string> = {
              'reviews': 'overview',
              'dish-confirmation': 'content',
              'optimization': 'insights',
            };
            setActiveTab(tabMap[tab] || tab);
          }}
        />

        {/* Main Tabs - Grouped into 5 clear sections */}
        <Tabs value={activeTab} defaultValue="overview" onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full h-auto p-1 flex overflow-x-auto sm:grid sm:grid-cols-5 gap-1">
            <TabsTrigger value="overview" className="flex items-center gap-1.5 py-2.5 px-3 text-xs sm:text-sm whitespace-nowrap shrink-0">
              <LayoutDashboard className="h-4 w-4" />
              <span>Overzicht</span>
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-1.5 py-2.5 px-3 text-xs sm:text-sm whitespace-nowrap shrink-0">
              <FileText className="h-4 w-4" />
              <span>Content</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center gap-1.5 py-2.5 px-3 text-xs sm:text-sm whitespace-nowrap shrink-0" disabled={!isVerified}>
              <BarChart3 className="h-4 w-4" />
              <span>Inzichten</span>
              {!isVerified && <Lock className="h-3 w-3" />}
            </TabsTrigger>
            <TabsTrigger value="marketing" className="flex items-center gap-1.5 py-2.5 px-3 text-xs sm:text-sm whitespace-nowrap shrink-0">
              <Megaphone className="h-4 w-4" />
              <span>Marketing</span>
            </TabsTrigger>
            <TabsTrigger value="market" className="flex items-center gap-1.5 py-2.5 px-3 text-xs sm:text-sm whitespace-nowrap shrink-0" disabled={!isVerified}>
              <TrendingUp className="h-4 w-4" />
              <span>Markt</span>
              {!isVerified && <Lock className="h-3 w-3" />}
            </TabsTrigger>
          </TabsList>

          {/* ===== OVERZICHT TAB ===== */}
          <TabsContent value="overview" className="space-y-6">
            {/* Reviews Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Reviews
                  {unansweredReviews > 0 && (
                    <Badge variant="destructive" className="text-xs">{unansweredReviews} onbeantwoord</Badge>
                  )}
                </h3>
              </div>

              {reviews.length > 0 ? (
                <div className="space-y-6">
                  {/* Review Intelligence */}
                  <ReviewIntelligence
                    reviews={reviews}
                    onApplyTemplate={(reviewId, text) => {
                      respondToReview(reviewId, text);
                    }}
                  />

                  {/* Review List */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Alle Reviews</h4>
                    {reviews.slice(0, 5).map(review => (
                      <ReviewCard
                        key={review.id}
                        review={review}
                        onRespond={respondToReview}
                        canRespond={isVerified}
                      />
                    ))}
                    {reviews.length > 5 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        En {reviews.length - 5} meer...
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground text-sm">Nog geen reviews ontvangen</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ===== CONTENT TAB ===== */}
          <TabsContent value="content" className="space-y-8">
            {/* Restaurant Quick Settings */}
            {selectedRestaurant && (
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Store className="h-5 w-5 text-primary" />
                  Restaurant Instellingen
                </h3>
                <Card>
                  <CardContent className="p-4 space-y-0 divide-y divide-border">
                    {/* Fully Halal Toggle */}
                    <ToggleRow
                      emoji="✓"
                      emojiClass="text-green-600 font-bold"
                      title="Volledig Halal"
                      description="Alle gerechten in dit restaurant zijn halal"
                      checked={(selectedRestaurant as any).is_fully_halal ?? false}
                      onChange={async (newValue) => {
                        const { error } = await supabase
                          .from('restaurants')
                          .update({ is_fully_halal: newValue } as any)
                          .eq('id', selectedRestaurant.id);
                        if (error) {
                          toast.error('Kon instelling niet opslaan');
                          return;
                        }
                        // Mark all restaurant_dishes as halal
                        if (newValue) {
                          await supabase
                            .from('restaurant_dishes')
                            .update({ is_halal: true } as any)
                            .eq('restaurant_id', selectedRestaurant.id)
                            .neq('status', 'rejected');
                        }
                        toast.success(newValue ? 'Restaurant als halal gemarkeerd — alle gerechten bijgewerkt' : 'Halal-markering verwijderd');
                        setSelectedRestaurant({ ...selectedRestaurant, is_fully_halal: newValue } as any);
                      }}
                    />
                    {/* Fully Vegetarian */}
                    <ToggleRow
                      emoji="🥬"
                      title="Volledig Vegetarisch"
                      description="Alle gerechten in dit restaurant zijn vegetarisch"
                      checked={(selectedRestaurant as any).is_fully_vegetarian ?? false}
                      onChange={async (newValue) => {
                        const { error } = await supabase
                          .from('restaurants')
                          .update({ is_fully_vegetarian: newValue } as any)
                          .eq('id', selectedRestaurant.id);
                        if (error) { toast.error('Kon instelling niet opslaan'); return; }
                        if (newValue) {
                          await supabase
                            .from('restaurant_dishes')
                            .update({ is_vegetarian: true } as any)
                            .eq('restaurant_id', selectedRestaurant.id)
                            .neq('status', 'rejected');
                        }
                        toast.success(newValue ? 'Restaurant als vegetarisch gemarkeerd' : 'Vegetarisch-markering verwijderd');
                        setSelectedRestaurant({ ...selectedRestaurant, is_fully_vegetarian: newValue } as any);
                      }}
                    />
                    {/* Fully Vegan */}
                    <ToggleRow
                      emoji="🌱"
                      title="Volledig Veganistisch"
                      description="Alle gerechten in dit restaurant zijn veganistisch"
                      checked={(selectedRestaurant as any).is_fully_vegan ?? false}
                      onChange={async (newValue) => {
                        const { error } = await supabase
                          .from('restaurants')
                          .update({ is_fully_vegan: newValue } as any)
                          .eq('id', selectedRestaurant.id);
                        if (error) { toast.error('Kon instelling niet opslaan'); return; }
                        if (newValue) {
                          await supabase
                            .from('restaurant_dishes')
                            .update({ is_vegan: true, is_vegetarian: true } as any)
                            .eq('restaurant_id', selectedRestaurant.id)
                            .neq('status', 'rejected');
                        }
                        toast.success(newValue ? 'Restaurant als veganistisch gemarkeerd' : 'Veganistisch-markering verwijderd');
                        setSelectedRestaurant({ ...selectedRestaurant, is_fully_vegan: newValue } as any);
                      }}
                    />
                    {/* Terrace */}
                    <ToggleRow
                      emoji="☀️"
                      title="Terras beschikbaar"
                      description="Gasten kunnen buiten zitten"
                      checked={(selectedRestaurant as any).has_terrace ?? false}
                      onChange={async (newValue) => {
                        const { error } = await supabase
                          .from('restaurants')
                          .update({ has_terrace: newValue } as any)
                          .eq('id', selectedRestaurant.id);
                        if (error) { toast.error('Kon instelling niet opslaan'); return; }
                        toast.success(newValue ? 'Terras geactiveerd' : 'Terras gedeactiveerd');
                        setSelectedRestaurant({ ...selectedRestaurant, has_terrace: newValue } as any);
                      }}
                    />
                    {/* Reservations */}
                    <ToggleRow
                      emoji="📅"
                      title="Reserveringen"
                      description="Dit restaurant accepteert reserveringen"
                      checked={(selectedRestaurant as any).accepts_reservations ?? false}
                      onChange={async (newValue) => {
                        const { error } = await supabase
                          .from('restaurants')
                          .update({ accepts_reservations: newValue } as any)
                          .eq('id', selectedRestaurant.id);
                        if (error) { toast.error('Kon instelling niet opslaan'); return; }
                        toast.success(newValue ? 'Reserveringen geactiveerd' : 'Reserveringen gedeactiveerd');
                        setSelectedRestaurant({ ...selectedRestaurant, accepts_reservations: newValue } as any);
                      }}
                    />
                    {/* Delivery */}
                    <ToggleRow
                      emoji="🚗"
                      title="Bezorging"
                      description="Dit restaurant biedt bezorging aan"
                      checked={(selectedRestaurant as any).has_delivery ?? false}
                      onChange={async (newValue) => {
                        const { error } = await supabase
                          .from('restaurants')
                          .update({ has_delivery: newValue } as any)
                          .eq('id', selectedRestaurant.id);
                        if (error) { toast.error('Kon instelling niet opslaan'); return; }
                        toast.success(newValue ? 'Bezorging geactiveerd' : 'Bezorging gedeactiveerd');
                        setSelectedRestaurant({ ...selectedRestaurant, has_delivery: newValue } as any);
                      }}
                    />
                    {/* Takeaway */}
                    <ToggleRow
                      emoji="🥡"
                      title="Afhaal"
                      description="Dit restaurant biedt afhaal aan"
                      checked={(selectedRestaurant as any).has_takeaway ?? false}
                      onChange={async (newValue) => {
                        const { error } = await supabase
                          .from('restaurants')
                          .update({ has_takeaway: newValue } as any)
                          .eq('id', selectedRestaurant.id);
                        if (error) { toast.error('Kon instelling niet opslaan'); return; }
                        toast.success(newValue ? 'Afhaal geactiveerd' : 'Afhaal gedeactiveerd');
                        setSelectedRestaurant({ ...selectedRestaurant, has_takeaway: newValue } as any);
                      }}
                    />
                  </CardContent>
                </Card>
              </div>
            )}
            {/* Dishes Confirmation */}
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <UtensilsCrossed className="h-5 w-5 text-primary" />
                Gerechten Bevestigen
                {suggestedDishCount > 0 && (
                  <Badge variant="secondary" className="text-xs">{suggestedDishCount} suggesties</Badge>
                )}
              </h3>
              {selectedRestaurant ? (
                <DishConfirmation restaurantId={selectedRestaurant.id} restaurantName={selectedRestaurant.name} />
              ) : (
                <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground text-sm">Selecteer een restaurant</p></CardContent></Card>
              )}
            </div>

            {/* Menu */}
            <div className="border-t pt-8">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <UtensilsCrossed className="h-5 w-5 text-primary" />
                Menu Beheren
              </h3>
              {selectedRestaurant ? (
                <MenuItemsManager restaurantId={selectedRestaurant.id} restaurantName={selectedRestaurant.name} />
              ) : (
                <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground text-sm">Selecteer een restaurant</p></CardContent></Card>
              )}
            </div>

            {/* Photos */}
            <div className="border-t pt-8">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <Image className="h-5 w-5 text-primary" />
                Foto's Beheren
              </h3>
              {isVerified && selectedRestaurant ? (
                <div className="space-y-4">
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">
                        Je foto's worden automatisch opgehaald van Google. Hier kun je ze vervangen of aanvullen.
                      </p>
                    </CardContent>
                  </Card>
                  <RestaurantImageUpload
                    restaurantId={selectedRestaurant.id}
                    restaurantName={selectedRestaurant.name}
                    existingImages={selectedRestaurant.images || []}
                    onImagesUpdate={() => toast.success('Foto\'s opgeslagen')}
                  />
                </div>
              ) : (
                <LockedFeatureOverlay 
                  featureName="Foto's Beheren"
                  description="Vervang of voeg nieuwe foto's toe aan je restaurantprofiel."
                  onRequestVerification={() => setVerificationDialogOpen(true)}
                />
              )}
            </div>

            {/* Events & Acties */}
            <div className="border-t pt-8">
              <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                <PartyPopper className="h-5 w-5 text-primary" />
                Events & Acties
              </h3>
              {selectedRestaurant ? (
                <OwnerEventsManager restaurantId={selectedRestaurant.id} restaurantName={selectedRestaurant.name} />
              ) : (
                <Card><CardContent className="py-8 text-center"><p className="text-muted-foreground text-sm">Selecteer een restaurant</p></CardContent></Card>
              )}
            </div>
          </TabsContent>

          {/* ===== INZICHTEN TAB ===== */}
          <TabsContent value="insights">
            {isVerified && selectedRestaurant ? (
              <div className="space-y-8">
                {/* Analytics */}
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Prestatie Analytics
                  </h3>
                  <AnalyticsTab analytics={analytics} restaurant={selectedRestaurant} reviews={reviews} />
                </div>

                {/* Search Ranking */}
                <div className="border-t pt-8">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Zoekpositie
                  </h3>
                  <SearchRanking restaurantId={selectedRestaurant.id} restaurantName={selectedRestaurant.name} />
                </div>

                {/* Dish Analytics */}
                <div className="border-t pt-8">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <UtensilsCrossed className="h-5 w-5 text-primary" />
                    Gerechten Analytics
                  </h3>
                  <DishAnalytics restaurantId={selectedRestaurant.id} restaurantName={selectedRestaurant.name} />
                </div>

                {/* Optimization */}
                <div className="border-t pt-8">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Gauge className="h-5 w-5 text-primary" />
                    Optimalisatie
                  </h3>
                  <OptimizationDashboard restaurantId={selectedRestaurant.id} restaurantName={selectedRestaurant.name} />
                </div>
              </div>
            ) : (
              <LockedFeatureOverlay 
                featureName="Inzichten & Analytics"
                description="Bekijk uitgebreide statistieken, gerechten analytics en optimalisatie-tips."
                onRequestVerification={() => setVerificationDialogOpen(true)}
              />
            )}
          </TabsContent>

          {/* ===== MARKETING TAB ===== */}
          <TabsContent value="marketing" className="space-y-8">
            {/* Featured / Premium */}
            {selectedRestaurant && (
              <>
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Premium Zichtbaarheid
                  </h3>
                  <FeaturedMarketplace 
                    restaurantId={selectedRestaurant.id} 
                    restaurantName={selectedRestaurant.name}
                    restaurantCuisines={selectedRestaurant.cuisines || []}
                    cityId={selectedRestaurant.city_id}
                    cityName={cityName || 'Stad'}
                  />
                </div>

                <div className="border-t pt-8">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Crown className="h-5 w-5 text-primary" />
                    Promoties & Listings
                  </h3>
                  <PromotionsSection 
                    restaurant={selectedRestaurant} 
                    onRefresh={() => window.location.reload()}
                    canPurchase={isVerified}
                  />
                </div>

                <div className="border-t pt-8">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Megaphone className="h-5 w-5 text-primary" />
                    Gerecht-specifieke Sponsoring
                  </h3>
                  <SponsoredMarketplace restaurantId={selectedRestaurant.id} restaurantName={selectedRestaurant.name} />
                </div>

                {isVerified && (
                  <div className="border-t pt-8">
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                      <Zap className="h-5 w-5 text-primary" />
                      Vraag Routing
                    </h3>
                    <DemandRoutingSettings restaurant={selectedRestaurant} />
                  </div>
                )}

                {/* Newsletter Placement */}
                <div className="border-t pt-8">
                  <NewsletterPlacement 
                    restaurantId={selectedRestaurant.id} 
                    restaurantName={selectedRestaurant.name} 
                  />
                </div>
              </>
            )}
          </TabsContent>

          {/* ===== MARKT TAB ===== */}
          <TabsContent value="market">
            {isVerified && selectedRestaurant ? (
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Buurtanalyse
                  </h3>
                  <NeighborhoodAnalysis
                    competitors={competitors}
                    myRating={selectedRestaurant.rating}
                    myReviewCount={selectedRestaurant.review_count}
                    myName={selectedRestaurant.name}
                  />
                </div>

                <div className="border-t pt-8">
                  <CompetitorBenchmark
                    restaurantId={selectedRestaurant.id}
                    cityId={selectedRestaurant.city_id}
                    cuisines={selectedRestaurant.cuisines || []}
                    rating={Number(selectedRestaurant.rating)}
                    reviewCount={selectedRestaurant.review_count}
                  />
                </div>

                <div className="border-t pt-8">
                  <DealsManager restaurantId={selectedRestaurant.id} />
                </div>

                <div className="border-t pt-8">
                  <QRCodeGenerator
                    restaurantSlug={selectedRestaurant.slug}
                    restaurantName={selectedRestaurant.name}
                  />
                </div>

                <div className="border-t pt-8">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5 text-primary" />
                    Piekuren-inzicht
                  </h3>
                  <PeakHoursInsight peakHours={peakHours} peakDays={peakDays} />
                </div>

                <div className="border-t pt-8">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <Crown className="h-5 w-5 text-primary" />
                    Promotie ROI
                  </h3>
                  <PromotionROI promotions={promotionROI} />
                </div>
              </div>
            ) : (
              <LockedFeatureOverlay 
                featureName="Markt & Concurrentie"
                description="Vergelijk je prestaties met concurrenten en bekijk het rendement van je promoties."
                onRequestVerification={() => setVerificationDialogOpen(true)}
              />
            )}
          </TabsContent>

        </Tabs>
      </div>

      {/* Verification Dialog */}
      {selectedRestaurant && (
        <VerificationRequiredDialog
          open={verificationDialogOpen}
          onOpenChange={setVerificationDialogOpen}
          claimId={activeClaimId}
          restaurantId={selectedRestaurant.id}
          restaurantName={selectedRestaurant.name}
          restaurantWebsite={selectedRestaurant.website_url}
          onVerificationComplete={() => {
            loadPermissions();
            setVerificationDialogOpen(false);
          }}
        />
      )}
    </Layout>
  );
}

// Reusable toggle row for restaurant settings
function ToggleRow({ emoji, emojiClass, title, description, checked, onChange }: {
  emoji: string;
  emojiClass?: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className={`text-lg ${emojiClass || ''}`}>{emoji}</span>
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
      </label>
    </div>
  );
}
