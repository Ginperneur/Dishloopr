import { useState, useEffect } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Eye, 
  MousePointer, 
  Phone, 
  Globe, 
  Calendar,
  Star,
  MessageSquare,
  TrendingUp,
  Store,
  ExternalLink,
  Sparkles,
  Crown,
  Loader2,
  Zap,
  Gauge,
  UtensilsCrossed,
  Lock,
  Shield,
  AlertTriangle
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useOwnerDashboard } from '@/hooks/useOwnerDashboard';
import { useRestaurantClaims } from '@/hooks/useRestaurantClaims';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SponsoredMarketplace } from '@/components/sponsored/SponsoredMarketplace';
import { DemandRoutingSettings } from '@/components/routing/DemandRoutingSettings';
import { OptimizationDashboard } from '@/components/optimization/OptimizationDashboard';
import { DishAnalytics } from '@/components/owner/DishAnalytics';
import { ClaimStatusBadge } from '@/components/claims/ClaimStatusBadge';
import { MenuItemsManager } from '@/components/admin/MenuItemsManager';
import { LockedFeatureOverlay } from '@/components/claims/LockedFeatureOverlay';
import { VerificationRequiredDialog } from '@/components/claims/VerificationRequiredDialog';
import { getClaimPermissions, type ClaimPermissions } from '@/types/claims';

function StatCard({ title, value, icon: Icon, trend, locked }: { 
  title: string; 
  value: string | number; 
  icon: React.ElementType;
  trend?: string;
  locked?: boolean;
}) {
  return (
    <Card className={locked ? 'opacity-60' : ''}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{locked ? '—' : value}</p>
            {trend && !locked && (
              <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3" />
                {trend}
              </p>
            )}
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            {locked ? (
              <Lock className="h-6 w-6 text-muted-foreground" />
            ) : (
              <Icon className="h-6 w-6 text-primary" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReviewCard({ review, onRespond, canRespond }: { 
  review: any; 
  onRespond: (reviewId: string, response: string) => Promise<boolean>;
  canRespond: boolean;
}) {
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [response, setResponse] = useState(review.owner_response || '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    const success = await onRespond(review.id, response);
    if (success) {
      toast.success('Reactie geplaatst');
      setShowResponseForm(false);
    } else {
      toast.error('Kon reactie niet plaatsen');
    }
    setSubmitting(false);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="font-semibold">{review.profile?.name || 'Anoniem'}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(review.created_at).toLocaleDateString('nl-NL')}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < review.rating ? 'fill-rating text-rating' : 'text-muted-foreground'
                }`}
              />
            ))}
          </div>
        </div>

        {review.title && <h4 className="font-medium mb-1">{review.title}</h4>}
        {review.body && <p className="text-muted-foreground mb-3">{review.body}</p>}

        <Badge variant={review.status === 'published' ? 'default' : 'secondary'}>
          {review.status === 'published' ? 'Gepubliceerd' : review.status === 'pending' ? 'In afwachting' : 'Gemarkeerd'}
        </Badge>

        {review.owner_response ? (
          <div className="mt-4 p-3 rounded-lg bg-muted border-l-2 border-primary">
            <p className="text-sm font-medium mb-1">Jouw reactie</p>
            <p className="text-sm text-muted-foreground">{review.owner_response}</p>
          </div>
        ) : canRespond ? (
          <div className="mt-4">
            {showResponseForm ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="Schrijf een reactie op deze review..."
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button onClick={handleSubmit} disabled={submitting || !response.trim()}>
                    {submitting ? 'Plaatsen...' : 'Reactie plaatsen'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowResponseForm(false)}>
                    Annuleren
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowResponseForm(true)}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Reageren
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-sm text-yellow-600 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Verificatie vereist om te reageren
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PromotionsSection({ restaurant, onRefresh, canPurchase }: { 
  restaurant: any; 
  onRefresh: () => void;
  canPurchase: boolean;
}) {
  const [searchParams] = useSearchParams();
  const [loadingType, setLoadingType] = useState<string | null>(null);

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const type = searchParams.get('type');
    
    if (paymentStatus === 'success') {
      toast.success(`${type === 'featured' ? 'Featured' : 'Top'} Listing succesvol geactiveerd!`);
      window.history.replaceState({}, '', '/owner-dashboard');
      onRefresh();
    } else if (paymentStatus === 'cancelled') {
      toast.info('Betaling geannuleerd');
      window.history.replaceState({}, '', '/owner-dashboard');
    }
  }, [searchParams, onRefresh]);

  const handlePurchase = async (listingType: 'featured' | 'top') => {
    if (!restaurant || !canPurchase) {
      toast.error('Verificatie vereist voor aankopen');
      return;
    }
    
    setLoadingType(listingType);
    try {
      const { data, error } = await supabase.functions.invoke('create-listing-checkout', {
        body: {
          listingType,
          restaurantId: restaurant.id,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err: any) {
      toast.error(err.message || 'Kon checkout niet starten');
    } finally {
      setLoadingType(null);
    }
  };

  const isFeatureActive = restaurant?.is_featured && restaurant?.featured_until && new Date(restaurant.featured_until) > new Date();
  const isTopActive = restaurant?.is_top_listing && restaurant?.top_until && new Date(restaurant.top_until) > new Date();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Promoot je Restaurant
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!canPurchase && (
            <div className="mb-6 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-center gap-2 text-yellow-600">
                <Lock className="h-4 w-4" />
                <span className="font-medium">Verificatie vereist</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Voltooi verificatie om promoties te kunnen kopen.
              </p>
            </div>
          )}

          <p className="text-muted-foreground mb-6">
            Vergroot je zichtbaarheid en trek meer klanten aan met onze promotie-opties.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Featured Listing */}
            <div className={`p-6 rounded-xl border-2 transition-colors ${isFeatureActive ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Featured Listing</h3>
                  <p className="text-sm text-muted-foreground">30 dagen</p>
                </div>
              </div>

              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Uitgelicht op de homepage
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Speciale badge bij je restaurant
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  +50% meer zichtbaarheid
                </li>
              </ul>

              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold">€49</p>
                {isFeatureActive ? (
                  <div className="text-right">
                    <Badge className="bg-green-500">Actief</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      tot {new Date(restaurant.featured_until).toLocaleDateString('nl-NL')}
                    </p>
                  </div>
                ) : (
                  <Button 
                    onClick={() => handlePurchase('featured')}
                    disabled={loadingType !== null || !canPurchase}
                  >
                    {loadingType === 'featured' ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Kopen
                  </Button>
                )}
              </div>
            </div>

            {/* Top Listing */}
            <div className={`p-6 rounded-xl border-2 transition-colors ${isTopActive ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                  <Crown className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Top Listing</h3>
                  <p className="text-sm text-muted-foreground">30 dagen</p>
                </div>
              </div>

              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Bovenaan alle zoekresultaten
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Premium badge
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  +100% meer zichtbaarheid
                </li>
              </ul>

              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold">€99</p>
                {isTopActive ? (
                  <div className="text-right">
                    <Badge className="bg-green-500">Actief</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      tot {new Date(restaurant.top_until).toLocaleDateString('nl-NL')}
                    </p>
                  </div>
                ) : (
                  <Button 
                    onClick={() => handlePurchase('top')}
                    disabled={loadingType !== null || !canPurchase}
                  >
                    {loadingType === 'top' ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Kopen
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardHeader>
          <CardTitle>Veelgestelde vragen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-1">Hoe lang duurt een listing?</h4>
            <p className="text-sm text-muted-foreground">
              Beide opties zijn 30 dagen geldig vanaf het moment van aankoop.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Kan ik beide opties combineren?</h4>
            <p className="text-sm text-muted-foreground">
              Ja! Je kunt zowel Featured als Top Listing tegelijk actief hebben voor maximale zichtbaarheid.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Hoe betaal ik?</h4>
            <p className="text-sm text-muted-foreground">
              We accepteren alle gangbare betaalmethoden via onze beveiligde betaalomgeving (Stripe).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OwnerDashboard() {
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const {
    restaurants,
    selectedRestaurant,
    setSelectedRestaurant,
    reviews,
    analytics,
    loading,
    respondToReview
  } = useOwnerDashboard();

  const { getPermissions } = useRestaurantClaims();
  const [permissions, setPermissions] = useState<ClaimPermissions | null>(null);
  const [verificationDialogOpen, setVerificationDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

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

  const handleProtectedAction = (action: string) => {
    if (!permissions?.isVerifiedOwner) {
      setPendingAction(action);
      setVerificationDialogOpen(true);
      return false;
    }
    return true;
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

  if (!user) {
    return <Navigate to="/login" replace />;
  }

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

        {/* Verification Banner */}
        {!isVerified && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-medium text-yellow-700">Beperkte toegang</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Je claim is nog niet geverifieerd. Sommige functies zijn vergrendeld tot je eigendom bewijst.
                    </p>
                    <Button 
                      size="sm" 
                      className="mt-3"
                      onClick={() => setVerificationDialogOpen(true)}
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Start verificatie
                    </Button>
                  </div>
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
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <StatCard
            title="Profielweergaven"
            value={analytics?.totalViews || 0}
            icon={Eye}
            trend="Laatste 30 dagen"
          />
          <StatCard
            title="Totale clicks"
            value={analytics?.totalClicks || 0}
            icon={MousePointer}
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
        <Tabs defaultValue={isVerified ? "dish-analytics" : "reviews"} className="space-y-6">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="reviews">
              Reviews ({reviews.length})
            </TabsTrigger>
            <TabsTrigger value="menu">
              <UtensilsCrossed className="h-4 w-4 mr-1" />
              Menu
            </TabsTrigger>
            <TabsTrigger value="dish-analytics" disabled={!isVerified}>
              <UtensilsCrossed className="h-4 w-4 mr-1" />
              Gerechten
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
            <TabsTrigger value="settings">
              Instellingen
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

          <TabsContent value="menu">
            {selectedRestaurant ? (
              <MenuItemsManager
                restaurantId={selectedRestaurant.id}
                restaurantName={selectedRestaurant.name}
              />
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
              <DishAnalytics 
                restaurantId={selectedRestaurant.id}
                restaurantName={selectedRestaurant.name}
              />
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
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Weergaven per dag (laatste 30 dagen)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics?.viewsByDay && analytics.viewsByDay.length > 0 ? (
                      <div className="h-64 flex items-end gap-1">
                        {analytics.viewsByDay.map((day, i) => {
                          const maxCount = Math.max(...analytics.viewsByDay.map(d => d.count));
                          const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                          return (
                            <div
                              key={day.date}
                              className="flex-1 bg-primary/80 hover:bg-primary transition-colors rounded-t"
                              style={{ height: `${Math.max(height, 5)}%` }}
                              title={`${day.date}: ${day.count} weergaven`}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-12">
                        Nog geen analytics data beschikbaar
                      </p>
                    )}
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">CTA Conversies</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Reserveringen</span>
                        <span className="font-semibold">{analytics?.reservationClicks || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Website bezoeken</span>
                        <span className="font-semibold">{analytics?.websiteClicks || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Telefoongesprekken</span>
                        <span className="font-semibold">{analytics?.phoneClicks || 0}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Review Statistieken</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Totaal reviews</span>
                        <span className="font-semibold">{selectedRestaurant?.review_count || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gemiddelde rating</span>
                        <span className="font-semibold flex items-center gap-1">
                          <Star className="h-4 w-4 fill-rating text-rating" />
                          {Number(selectedRestaurant?.rating || 0).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Beantwoord</span>
                        <span className="font-semibold">
                          {reviews.filter(r => r.owner_response).length} / {reviews.length}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
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
              <SponsoredMarketplace 
                restaurantId={selectedRestaurant.id} 
                restaurantName={selectedRestaurant.name}
              />
            )}
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
              <OptimizationDashboard 
                restaurantId={selectedRestaurant.id}
                restaurantName={selectedRestaurant.name}
              />
            ) : (
              <LockedFeatureOverlay 
                featureName="Optimalisatie Dashboard"
                description="Krijg inzichten en tips om je zichtbaarheid te verbeteren."
                onRequestVerification={() => setVerificationDialogOpen(true)}
              />
            )}
          </TabsContent>

          <TabsContent value="settings">
            <PromotionsSection 
              restaurant={selectedRestaurant} 
              onRefresh={() => window.location.reload()}
              canPurchase={isVerified}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Verification Dialog */}
      {selectedRestaurant && (
        <VerificationRequiredDialog
          open={verificationDialogOpen}
          onOpenChange={setVerificationDialogOpen}
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
