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
  Clock
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
import { StatCard } from '@/components/owner/StatCard';
import { ReviewCard } from '@/components/owner/ReviewCard';
import { AnalyticsTab } from '@/components/owner/AnalyticsTab';
import { PromotionsSection } from '@/components/owner/PromotionsSection';
import { SponsoredMarketplace } from '@/components/sponsored/SponsoredMarketplace';
import { FeaturedMarketplace } from '@/components/featured/FeaturedMarketplace';
import { DemandRoutingSettings } from '@/components/routing/DemandRoutingSettings';
import { OptimizationDashboard } from '@/components/optimization/OptimizationDashboard';
import { DishAnalytics } from '@/components/owner/DishAnalytics';
import { ClaimStatusBadge } from '@/components/claims/ClaimStatusBadge';
import { MenuItemsManager } from '@/components/admin/MenuItemsManager';
import { LockedFeatureOverlay } from '@/components/claims/LockedFeatureOverlay';
import { VerificationRequiredDialog } from '@/components/claims/VerificationRequiredDialog';
import { DishConfirmation } from '@/components/owner/DishConfirmation';
import { RestaurantImageUpload } from '@/components/admin/RestaurantImageUpload';
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
    // Simple approximation: split 30-day data in half
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

  return (
    <Layout>
      <div className="container py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-1">Owner Dashboard</h1>
              <p className="text-muted-foreground">Beheer je restaurant en bekijk statistieken</p>
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

          {selectedRestaurant && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="text-sm">
                {selectedRestaurant.name}
              </Badge>
              <ClaimStatusBadge 
                status={selectedRestaurant.claim_status || 'unclaimed'} 
                size="sm" 
              />
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/restaurant/${selectedRestaurant.slug}`}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Bekijk pagina
                </Link>
              </Button>
            </div>
          )}
        </motion.div>

        {/* Status Banner */}
        {isVerified ? (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-green-700">Geverifieerde eigenaar</h3>
                    <p className="text-sm text-muted-foreground">
                      Je hebt volledige toegang tot alle functies van het dashboard.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            {isPendingAdminReview ? (
              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-medium text-blue-700">In afwachting van admin review</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Je betaling is ontvangen, maar de naam op de betaling komt niet overeen met het restaurant. 
                        Een admin zal je aanvraag handmatig beoordelen.
                      </p>
                      <Button size="sm" variant="outline" className="mt-3" asChild>
                        <Link to="/contact">Neem contact op</Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-yellow-500/30 bg-yellow-500/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="font-medium text-yellow-700">Beperkte toegang</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Je claim is nog niet geverifieerd. Sommige functies zijn vergrendeld tot je eigendom bewijst.
                      </p>
                      <Button size="sm" className="mt-3" onClick={() => setVerificationDialogOpen(true)}>
                        <Shield className="h-4 w-4 mr-2" />
                        Start verificatie
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        )}

        {/* Stats Grid with Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
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

        {/* Tabs */}
        <Tabs defaultValue={isVerified ? "dish-confirmation" : "reviews"} className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="reviews">
              Reviews ({reviews.length})
            </TabsTrigger>
            <TabsTrigger value="photos" disabled={!isVerified}>
              <Image className="h-4 w-4 mr-1" />
              Foto's
              {!isVerified && <Lock className="h-3 w-3 ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="dish-confirmation">
              <Check className="h-4 w-4 mr-1" />
              Gerechten Bevestigen
            </TabsTrigger>
            <TabsTrigger value="menu">
              <UtensilsCrossed className="h-4 w-4 mr-1" />
              Menu
            </TabsTrigger>
            <TabsTrigger value="dish-analytics" disabled={!isVerified}>
              <UtensilsCrossed className="h-4 w-4 mr-1" />
              Gerechten Analytics
              {!isVerified && <Lock className="h-3 w-3 ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="analytics" disabled={!isVerified}>
              Analytics
              {!isVerified && <Lock className="h-3 w-3 ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="sponsored">
              <Sparkles className="h-4 w-4 mr-1" />
              Sponsoring
            </TabsTrigger>
            <TabsTrigger value="promotions">
              <Crown className="h-4 w-4 mr-1" />
              Promoties
            </TabsTrigger>
            <TabsTrigger value="routing" disabled={!isVerified}>
              <Zap className="h-4 w-4 mr-1" />
              Vraag Routing
              {!isVerified && <Lock className="h-3 w-3 ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="optimization" disabled={!isVerified}>
              <Gauge className="h-4 w-4 mr-1" />
              Optimalisatie
              {!isVerified && <Lock className="h-3 w-3 ml-1" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reviews" className="space-y-4">
            {reviews.length > 0 ? (
              reviews.map(review => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onRespond={respondToReview}
                  canRespond={isVerified}
                />
              ))
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nog geen reviews ontvangen</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="photos">
            {isVerified && selectedRestaurant ? (
              <div className="space-y-4">
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Image className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium mb-1">Foto's beheren</p>
                        <p className="text-muted-foreground">
                          Je foto's worden automatisch opgehaald van Google bij het aanmaken van je profiel. 
                          Hier kun je ze vervangen of aanvullen met eigen foto's.
                        </p>
                      </div>
                    </div>
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
          </TabsContent>

          <TabsContent value="dish-confirmation">
            {selectedRestaurant ? (
              <DishConfirmation restaurantId={selectedRestaurant.id} restaurantName={selectedRestaurant.name} />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Selecteer een restaurant</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="menu">
            {selectedRestaurant ? (
              <MenuItemsManager restaurantId={selectedRestaurant.id} restaurantName={selectedRestaurant.name} />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Selecteer een restaurant</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="dish-analytics">
            {isVerified && selectedRestaurant ? (
              <DishAnalytics restaurantId={selectedRestaurant.id} restaurantName={selectedRestaurant.name} />
            ) : (
              <LockedFeatureOverlay 
                featureName="Gerechten Analytics"
                description="Bekijk welke gerechten het populairst zijn en hoe ze presteren."
                onRequestVerification={() => setVerificationDialogOpen(true)}
              />
            )}
          </TabsContent>

          <TabsContent value="analytics">
            {isVerified ? (
              <AnalyticsTab analytics={analytics} restaurant={selectedRestaurant} reviews={reviews} />
            ) : (
              <LockedFeatureOverlay 
                featureName="Gedetailleerde Analytics"
                description="Bekijk uitgebreide statistieken over je restaurant prestaties."
                onRequestVerification={() => setVerificationDialogOpen(true)}
              />
            )}
          </TabsContent>

          <TabsContent value="sponsored">
            {selectedRestaurant && (
              <div className="space-y-8">
                <FeaturedMarketplace 
                  restaurantId={selectedRestaurant.id} 
                  restaurantName={selectedRestaurant.name}
                  restaurantCuisines={selectedRestaurant.cuisines || []}
                  cityId={selectedRestaurant.city_id}
                  cityName={cityName || 'Stad'}
                />
                <div className="pt-6 border-t">
                  <h3 className="text-lg font-semibold mb-4 text-muted-foreground">Gerecht-specifieke promoties</h3>
                  <SponsoredMarketplace restaurantId={selectedRestaurant.id} restaurantName={selectedRestaurant.name} />
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="promotions">
            <PromotionsSection 
              restaurant={selectedRestaurant} 
              onRefresh={() => window.location.reload()}
              canPurchase={isVerified}
            />
          </TabsContent>

          <TabsContent value="routing">
            {isVerified && selectedRestaurant ? (
              <DemandRoutingSettings restaurant={selectedRestaurant} />
            ) : (
              <LockedFeatureOverlay 
                featureName="Vraag Routing"
                description="Ontvang klanten die op zoek zijn naar gerechten die jij aanbiedt."
                onRequestVerification={() => setVerificationDialogOpen(true)}
              />
            )}
          </TabsContent>

          <TabsContent value="optimization">
            {isVerified && selectedRestaurant ? (
              <OptimizationDashboard restaurantId={selectedRestaurant.id} restaurantName={selectedRestaurant.name} />
            ) : (
              <LockedFeatureOverlay 
                featureName="Optimalisatie Dashboard"
                description="Krijg inzichten en tips om je zichtbaarheid te verbeteren."
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
