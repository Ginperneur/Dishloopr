import { useState, useEffect, type ReactNode } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Eye,
  MousePointer,
  Globe,
  Phone,
  MapPin,
  Star,
  MessageSquare,
  Store,
  ExternalLink,
  Sparkles,
  Crown,
  Zap,
  Gauge,
  UtensilsCrossed,
  Shield,
  AlertTriangle,
  Check,
  Image,
  Clock,
  TrendingUp,
  BarChart3,
  Megaphone,
  FileText,
  Rocket,
  PartyPopper,
  Instagram,
  ChevronsUpDown,
  Plug,
  HelpCircle,
  Search,
  Settings,
  CalendarCheck,
  Languages,
  Link2,
  QrCode,
  Tag,
  Ticket,
} from 'lucide-react';
import { MyPackagesCard } from '@/components/owner/MyPackagesCard';
import { ProGrowthInsights } from '@/components/owner/ProGrowthInsights';
import { Layout } from '@/components/layout/Layout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { OwnerSidebar } from '@/components/owner/OwnerSidebar';
import { OwnerCommandPalette } from '@/components/owner/OwnerCommandPalette';
import { OwnerDashboardSkeleton } from '@/components/owner/OwnerDashboardSkeleton';
import { OwnerTabHeader } from '@/components/owner/OwnerTabHeader';
import { OwnerHelpDialog } from '@/components/owner/OwnerHelpDialog';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useOwnerDashboard } from '@/hooks/useOwnerDashboard';
import { useRestaurantClaims } from '@/hooks/useRestaurantClaims';
import { useOwnerProCheckout } from '@/hooks/useOwnerProCheckout';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/owner/StatCard';
import { ReviewCard } from '@/components/owner/ReviewCard';
import { AnalyticsTab } from '@/components/owner/AnalyticsTab';
import { SponsoredMarketplace } from '@/components/sponsored/SponsoredMarketplace';
import { DemandRoutingSettings } from '@/components/routing/DemandRoutingSettings';
import { OptimizationDashboard } from '@/components/optimization/OptimizationDashboard';
import { DishAnalytics } from '@/components/owner/DishAnalytics';
import { SearchRanking } from '@/components/owner/SearchRanking';
import { ClaimStatusBadge } from '@/components/claims/ClaimStatusBadge';
import { MenuItemsManager } from '@/components/admin/MenuItemsManager';
import { OwnerMenuUpload } from '@/components/owner/OwnerMenuUpload';
import { OwnerHiddenNotice } from '@/components/owner/OwnerHiddenNotice';
import { LockedFeatureOverlay } from '@/components/claims/LockedFeatureOverlay';
import { VerificationRequiredDialog } from '@/components/claims/VerificationRequiredDialog';
import { DishConfirmation } from '@/components/owner/DishConfirmation';
import { TagRequestForm } from '@/components/owner/TagRequestForm';
import { TagManager } from '@/components/owner/TagManager';
import { RestaurantImageUpload } from '@/components/admin/RestaurantImageUpload';
import { DailyBriefing } from '@/components/owner/DailyBriefing';
import { ReviewIntelligence } from '@/components/owner/ReviewIntelligence';
import { NeighborhoodAnalysis } from '@/components/owner/NeighborhoodAnalysis';
import { PeakHoursInsight } from '@/components/owner/PeakHoursInsight';
import { PromotionROI } from '@/components/owner/PromotionROI';
import { OwnerEventsManager } from '@/components/owner/OwnerEventsManager';
import { SocialLinksManager } from '@/components/owner/SocialLinksManager';
import { ReservationLinkManager } from '@/components/owner/ReservationLinkManager';
import { ReservationIntegrations } from '@/components/owner/ReservationIntegrations';
import { ReservationStatsCard } from '@/components/owner/ReservationStatsCard';
import { NewsletterPlacement } from '@/components/owner/NewsletterPlacement';
import { InvoicesTab } from '@/components/owner/InvoicesTab';
import { QRCodeGenerator } from '@/components/owner/QRCodeGenerator';
import { CompetitorBenchmark } from '@/components/owner/CompetitorBenchmark';
import { DealsManager } from '@/components/owner/DealsManager';
import { NotificationBell } from '@/components/owner/NotificationBell';
import { QuickShareMenu } from '@/components/owner/QuickShareMenu';
import { WeeklyReportToggle } from '@/components/owner/WeeklyReportToggle';
import { AnomalyAlertToggle } from '@/components/owner/AnomalyAlertToggle';
import { EventReportToggle } from '@/components/owner/EventReportToggle';
import { ProGate } from '@/components/owner/ProGate';
import { OwnerFunnel } from '@/components/owner/OwnerFunnel';
import { SearchTermHeatmap } from '@/components/owner/SearchTermHeatmap';
import { ChannelAttribution } from '@/components/owner/ChannelAttribution';
import { WeeklyRecommendations } from '@/components/owner/WeeklyRecommendations';
import { HistoricalBenchmark } from '@/components/owner/HistoricalBenchmark';
import { InsightsExportButton } from '@/components/owner/InsightsExportButton';
import { FunnelAnomalies } from '@/components/owner/FunnelAnomalies';
import { ResponseTemplatesManager } from '@/components/owner/ResponseTemplatesManager';
import { TeamMembersManager } from '@/components/owner/TeamMembersManager';
import { InternalFeedbackInbox } from '@/components/owner/InternalFeedbackInbox';
import { PromoCodesManager } from '@/components/owner/PromoCodesManager';
import { LoyaltyProgramManager } from '@/components/owner/LoyaltyProgramManager';
import { SocialPostGenerator } from '@/components/owner/SocialPostGenerator';
import { UpgradeToProCard } from '@/components/owner/UpgradeToProCard';
import { ProPaywall } from '@/components/owner/ProPaywall';
import { ProUpsellBanner } from '@/components/owner/ProUpsellBanner';
import { OwnerTour } from '@/components/owner/OwnerTour';
import { useOwnerTier } from '@/hooks/useOwnerTier';
import { OpeningHoursExceptions } from '@/components/owner/OpeningHoursExceptions';
import { OwnerContactCard } from '@/components/owner/OwnerContactCard';
import { MultiLanguageProfile } from '@/components/owner/MultiLanguageProfile';
import { BasicInfoEditor } from '@/components/owner/BasicInfoEditor';
import { ParkingEditor } from '@/components/restaurant/ParkingEditor';
import { CrossPromotionManager } from '@/components/owner/CrossPromotionManager';
import { BestTimeToPost } from '@/components/owner/BestTimeToPost';
import { LostToCompetitor } from '@/components/owner/LostToCompetitor';
import { EventsCalendarView } from '@/components/owner/EventsCalendarView';
import { ContactDetailsEditor } from '@/components/owner/ContactDetailsEditor';
import { PagePreviewCard } from '@/components/owner/PagePreviewCard';
import { PageScoreCard } from '@/components/owner/PageScoreCard';
import { PackagesSummary } from '@/components/owner/PackagesSummary';
import { AccountSettings } from '@/components/owner/AccountSettings';
import { useMarketInsights } from '@/hooks/useMarketInsights';
import { useRestaurantDishes } from '@/hooks/useRestaurantDishes';
import { type ClaimPermissions } from '@/types/claims';
import { PendingClaimCodes } from '@/components/claims/PendingClaimCodes';
import { OWNER_TABS, resolveOwnerTab, type OwnerTab } from '@/lib/ownerTabs';
import { pageTasks, type PageTask } from '@/lib/pageScore';
import { ownerFirstName, safePercent } from '@/lib/ownerFormat';

export default function OwnerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const { refreshStatus: refreshProStatus } = useOwnerProCheckout();
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
  const initial = resolveOwnerTab(searchParams.get('tab'));
  const [activeTab, setActiveTab] = useState<OwnerTab>(initial.tab);
  const [insightsTab, setInsightsTab] = useState<string>(initial.tab === 'insights' && initial.sub ? initial.sub : 'visitors');
  const [settingsTab, setSettingsTab] = useState<string>(initial.tab === 'settings' && initial.sub ? initial.sub : 'account');
  const [contactOpen, setContactOpen] = useState(false);
  const [reviewLimit, setReviewLimit] = useState(10);
  const [ownerName, setOwnerName] = useState<string | null>(null);
  // Opens a section; old ids (content, market, invoices, ...) still work for mails and Stripe returns.
  const go = (id: string) => {
    const t = resolveOwnerTab(id);
    setActiveTab(t.tab);
    if (t.tab === 'insights') setInsightsTab(t.sub ?? 'visitors');
    if (t.tab === 'settings' && t.sub) setSettingsTab(t.sub);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const [restaurantPickerOpen, setRestaurantPickerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const { dishes: restaurantDishes } = useRestaurantDishes({ restaurantId: selectedRestaurant?.id || '', enabled: !!selectedRestaurant?.id });
  const { competitors, peakHours, peakDays, promotionROI } = useMarketInsights(
    selectedRestaurant?.id,
    selectedRestaurant?.city_id,
    selectedRestaurant?.cuisines || []
  );

  const { data: ownerTier } = useOwnerTier(selectedRestaurant?.id);
  const isPro = ownerTier === 'pro';

  // Owner's first name for the greeting (was the first word of the restaurant name).
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();
      setOwnerName(ownerFirstName({ profileName: data?.name, metaName: user.user_metadata?.name, email: user.email }));
    })();
  }, [user]);

  // Menu minimum for full visibility and the restaurant's count towards it (same rule as the public site).
  const { data: menuProgress } = useQuery({
    queryKey: ['owner-menu-progress', selectedRestaurant?.id],
    enabled: !!selectedRestaurant?.id,
    queryFn: async () => {
      const rpc = supabase.rpc as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown }>;
      const [min, count] = await Promise.all([
        rpc('visibility_menu_minimum'),
        rpc('menu_dish_count', { p_restaurant_id: selectedRestaurant!.id }),
      ]);
      return { minimum: Number(min.data ?? 5) || 5, count: Number(count.data ?? 0) };
    },
  });

  const unansweredReviews = reviews.filter(r => !r.owner_response).length;
  const suggestedDishCount = restaurantDishes.filter(d => d.status === 'suggested').length;

  const activeClaim = selectedRestaurant 
    ? userClaims.find(c => c.restaurant_id === selectedRestaurant.id && !['superseded', 'rejected'].includes(c.status))
    : undefined;
  const activeClaimId = activeClaim?.id;
  const isPendingAdminReview = activeClaim?.status === 'pending_admin_review';

  useEffect(() => {
    document.title = 'Owner dashboard | Dishloopr';
  }, []);

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
      toast.success('Verificatie betaald ✓', {
        description: `Je verificatie is geactiveerd op ${new Date().toLocaleDateString('nl-NL')}. Een admin reviewt je aanvraag — meestal binnen 1 werkdag.`,
        duration: 10000,
        action: {
          label: 'Bekijk status',
          onClick: () => go('overview'),
        },
      });
      window.history.replaceState({}, '', '/owner-dashboard');
    } else if (verification === 'cancelled') {
      toast.error('Verificatie betaling geannuleerd.');
      window.history.replaceState({}, '', '/owner-dashboard');
    }

    // Handle newsletter redirect from Stripe
    const newsletter = searchParams.get('newsletter');
    if (newsletter === 'success') {
      toast.success('Nieuwsbrief plaatsing geactiveerd ✓', {
        description: `Je plaatsing is besteld op ${new Date().toLocaleDateString('nl-NL')} en wordt voor verzending door ons team gecheckt.`,
        duration: 10000,
        action: {
          label: 'Naar Promoties',
          onClick: () => go('promotions'),
        },
      });
      go('promotions');
      window.history.replaceState({}, '', '/owner-dashboard');
    } else if (newsletter === 'cancelled') {
      toast.info('Nieuwsbrief betaling geannuleerd.');
      window.history.replaceState({}, '', '/owner-dashboard');
    }

    // Handle Owner Pro checkout redirect from Stripe
    const proCheckout = searchParams.get('pro_checkout');
    if (proCheckout === 'success') {
      toast.success('Welkom bij Owner Pro 🎉', {
        description: `Je abonnement is actief vanaf ${new Date().toLocaleDateString('nl-NL')}. Inzichten, Markt en onbeperkte tags staan nu voor je open.`,
        duration: 12000,
        action: {
          label: 'Bekijk Inzichten',
          onClick: () => go('insights'),
        },
      });
      refreshProStatus();
      setTimeout(() => refreshProStatus(), 3000);
      window.history.replaceState({}, '', '/owner-dashboard');
    } else if (proCheckout === 'cancelled') {
      toast.info('Pro upgrade geannuleerd.');
      window.history.replaceState({}, '', '/owner-dashboard');
    }

    // Handle Featured marketplace checkout
    const featured = searchParams.get('featured');
    if (featured === 'success') {
      toast.success('Premium plek geactiveerd ✓', {
        description: `Je staat per ${new Date().toLocaleDateString('nl-NL')} bovenaan in zoekresultaten. Bekijk de looptijd in je promoties.`,
        duration: 12000,
        action: {
          label: 'Bekijk looptijd',
          onClick: () => go('promotions'),
        },
      });
      go('promotions');
      window.history.replaceState({}, '', '/owner-dashboard');
    } else if (featured === 'cancelled') {
      toast.info('Premium plek niet afgerond.');
      window.history.replaceState({}, '', '/owner-dashboard');
    }

    // Handle Listing boost checkout
    const listing = searchParams.get('listing');
    if (listing === 'success') {
      toast.success('Listing boost geactiveerd ✓', {
        description: `Je boost is actief vanaf ${new Date().toLocaleDateString('nl-NL')} en loopt 30 dagen.`,
        duration: 10000,
        action: { label: 'Bekijk looptijd', onClick: () => go('promotions') },
      });
      go('promotions');
      window.history.replaceState({}, '', '/owner-dashboard');
    }

    // Handle Sponsored dish checkout
    const sponsored = searchParams.get('sponsored');
    if (sponsored === 'success') {
      toast.success('Gesponsord gerecht geactiveerd ✓', {
        description: `Je gerecht wordt uitgelicht vanaf ${new Date().toLocaleDateString('nl-NL')}.`,
        duration: 10000,
        action: { label: 'Bekijk looptijd', onClick: () => go('promotions') },
      });
      go('promotions');
      window.history.replaceState({}, '', '/owner-dashboard');
    }

    // Checkout return and links in the monthly event report open Promoties, where events now live.
    const eventCheckout = searchParams.get('event_checkout');
    if (eventCheckout || searchParams.get('section') === 'evenementen') {
      if (eventCheckout === 'success') {
        toast.success('Betaling ontvangen', { description: 'Je evenement staat binnen een paar minuten online.', duration: 10000 });
      }
      go('promotions');
      window.history.replaceState({}, '', '/owner-dashboard');
    }

    // Extra tag, featured and listing checkouts return here; their status lives under Promoties.
    const tagAdded = searchParams.get('tag_added');
    const payment = searchParams.get('payment');
    if (tagAdded || payment) {
      if (tagAdded) toast.success(`Tag ${tagAdded} toegevoegd`, { description: 'Je tag staat binnen een paar minuten op je pagina.', duration: 10000 });
      else if (payment === 'success') toast.success('Betaling ontvangen', { description: 'Je promotie staat hieronder bij Promoties.', duration: 10000 });
      else toast.info('Betaling niet afgerond.');
      go('promotions');
      window.history.replaceState({}, '', '/owner-dashboard');
    }

    // Founding Partner / Menuservice checkout return and the monthly Founding Partner report.
    const packageCheckout = searchParams.get('package_checkout');
    if (packageCheckout || searchParams.get('section') === 'promotions') {
      if (packageCheckout === 'success') {
        toast.success('Betaling geregeld', { description: 'Je pakket staat hieronder bij Promoties en je plek is direct live.', duration: 10000 });
      }
      go('promotions');
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

  if (authLoading || loading) {
    return <OwnerDashboardSkeleton />;
  }

  if (!user) return <Navigate to="/login" replace />;

  if (restaurants.length === 0) {
    return (
      <Layout>
        <SEOHead
          title="Owner dashboard | Dishloopr"
          description="Beheer je restaurantprofiel, foto's, gerechten en reviews in het Dishloopr Owner dashboard."
          noindex
        />
        <div className="container py-16 text-center">
          <PendingClaimCodes />
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
  const r = selectedRestaurant as (typeof selectedRestaurant & Record<string, any>) | null;

  const tasks = pageTasks({
    isVerified,
    description: r?.description,
    images: r?.images,
    openingHours: r?.opening_hours,
    phone: r?.phone,
    websiteUrl: r?.website_url,
    instagramUrl: r?.instagram_url,
    tiktokUrl: r?.tiktok_url,
    approvedDishes: menuProgress?.count ?? restaurantDishes.filter(d => d.status === 'verified_by_owner' || d.status === 'approved_by_admin').length,
    suggestedDishes: suggestedDishCount,
    menuMinimum: menuProgress?.minimum ?? 5,
    unansweredReviews,
  });
  const openTask = (t: PageTask) => (t.tab === 'verify' ? setVerificationDialogOpen(true) : go(t.tab));

  const saveToggle = async (column: string, value: boolean, labels: [string, string], extra?: () => Promise<unknown>) => {
    if (!r) return;
    const { error } = await supabase.from('restaurants').update({ [column]: value } as never).eq('id', r.id);
    if (error) { toast.error('Kon instelling niet opslaan'); return; }
    if (value && extra) await extra();
    toast.success(value ? labels[0] : labels[1]);
    setSelectedRestaurant({ ...r, [column]: value } as any);
  };
  const markDishes = (patch: Record<string, boolean>) => async () => {
    await supabase.from('restaurant_dishes').update(patch as never).eq('restaurant_id', r!.id).neq('status', 'rejected');
  };

  const locked = (featureName: string, description: string) => (
    <LockedFeatureOverlay featureName={featureName} description={description} onRequestVerification={() => setVerificationDialogOpen(true)} />
  );
  const section = (title: string, icon: typeof Store, children: ReactNode, id?: string) => {
    const Icon = icon;
    return (
      <section id={id} className="space-y-4 border-t pt-8 first:border-t-0 first:pt-0">
        <h3 className="flex items-center gap-2 text-lg font-semibold"><Icon className="h-5 w-5 text-primary" />{title}</h3>
        {children}
      </section>
    );
  };

  return (
    <Layout showFooter={false}>
      <SEOHead
        title="Owner dashboard | Dishloopr"
        description="Beheer je restaurantprofiel, foto's, gerechten en reviews in het Dishloopr Owner dashboard."
        noindex
      />
      <SidebarProvider defaultOpen={true}>
        <div className="owner-shell flex w-full min-h-[calc(100svh-4rem)] animate-in fade-in duration-300">
          <a href="#owner-main" className="skip-link">Direct naar inhoud</a>
          <OwnerSidebar
            activeTab={activeTab}
            onChange={go}
            isVerified={isVerified}
            unansweredReviews={unansweredReviews}
            onOpenHelp={() => setContactOpen(true)}
          />
          <OwnerCommandPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            activeTab={activeTab}
            onChangeTab={go}
            restaurants={restaurants.map((x) => ({ id: x.id, name: x.name, slug: x.slug }))}
            selectedRestaurantId={selectedRestaurant?.id}
            onSelectRestaurant={(id) => {
              const x = restaurants.find((y) => y.id === id);
              if (x) setSelectedRestaurant(x);
            }}
          />
          <OwnerHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
          <Dialog open={contactOpen} onOpenChange={setContactOpen}>
            <DialogContent className="max-h-[90svh] max-w-2xl overflow-y-auto p-0">
              <DialogTitle className="sr-only">Hulp en contact</DialogTitle>
              <OwnerContactCard restaurantId={selectedRestaurant?.id} restaurantName={selectedRestaurant?.name} />
            </DialogContent>
          </Dialog>
          <div className="flex-1 flex flex-col min-w-0">
            {/* Sticky inner header */}
            <div className="sticky top-14 md:top-16 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
              <div className="w-full px-4 md:px-6 py-3 flex items-center gap-2 md:gap-3">
                <SidebarTrigger className="shrink-0" />
                <div className="hidden sm:block h-6 w-px bg-border" />
                {restaurants.length > 1 ? (
                  <Popover open={restaurantPickerOpen} onOpenChange={setRestaurantPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" role="combobox" aria-expanded={restaurantPickerOpen}
                        className="max-w-[220px] md:max-w-[320px] justify-between px-2 font-medium">
                        <span className="truncate">{selectedRestaurant?.name || 'Selecteer restaurant'}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <Command filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
                        <CommandInput placeholder="Zoek restaurant..." />
                        <CommandList>
                          <CommandEmpty>Geen restaurant gevonden.</CommandEmpty>
                          <CommandGroup>
                            {restaurants.map(restaurant => (
                              <CommandItem key={restaurant.id} value={restaurant.name}
                                onSelect={() => { setSelectedRestaurant(restaurant); setRestaurantPickerOpen(false); }}>
                                <Check className={cn('mr-2 h-4 w-4', selectedRestaurant?.id === restaurant.id ? 'opacity-100' : 'opacity-0')} />
                                <span className="truncate">{restaurant.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span className="font-medium truncate max-w-[220px] md:max-w-none">{selectedRestaurant?.name || 'Dashboard'}</span>
                )}
                <span className="hidden sm:inline-flex"><ClaimStatusBadge status={selectedRestaurant?.claim_status || 'unclaimed'} size="sm" /></span>
                <div className="flex-1" />
                <Button variant="outline" size="sm" onClick={() => setPaletteOpen(true)}
                  className="hidden lg:inline-flex h-9 gap-2 text-muted-foreground" aria-label="Snel zoeken">
                  <span className="text-xs">Snel zoeken</span>
                  <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">⌘K</kbd>
                </Button>
                {selectedRestaurant && (
                  <Button variant="outline" size="sm" className="h-9" asChild>
                    <Link to={`/restaurant/${selectedRestaurant.slug}`} target="_blank" rel="noopener">
                      <Eye className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Bekijk je pagina</span>
                    </Link>
                  </Button>
                )}
                {selectedRestaurant && (
                  <QuickShareMenu restaurantSlug={selectedRestaurant.slug} restaurantName={selectedRestaurant.name} address={r?.address} />
                )}
                <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:inline-flex" aria-label="Toon sneltoetsen" onClick={() => setHelpOpen(true)}>
                  <HelpCircle className="h-4 w-4" />
                </Button>
                <NotificationBell />
              </div>
            </div>

            <div id="owner-main" tabIndex={-1} role="main"
              className="w-full px-4 md:px-6 py-6 md:py-8 max-w-[1280px] mx-auto focus:outline-none">
              <PendingClaimCodes />

              {/* Verification status */}
              {!isVerified && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                  <Card className={isPendingAdminReview ? 'border-primary/30 bg-primary/5' : 'border-accent/30 bg-accent/5'}>
                    <CardContent className="flex items-center gap-3 p-4">
                      {isPendingAdminReview ? <Clock className="h-5 w-5 shrink-0 text-primary" /> : <AlertTriangle className="h-5 w-5 shrink-0 text-accent-foreground" />}
                      <div className="flex-1">
                        <p className="text-sm font-medium">{isPendingAdminReview ? 'In afwachting van controle' : 'Beperkte toegang'}</p>
                        <p className="text-xs text-muted-foreground">
                          {isPendingAdminReview
                            ? 'We hebben je aanvraag ontvangen en controleren hem meestal binnen 1 werkdag.'
                            : 'Verifieer dat je de eigenaar bent, dan kun je alles op je pagina zelf aanpassen.'}
                        </p>
                      </div>
                      {isPendingAdminReview ? (
                        <Button size="sm" variant="outline" onClick={() => setContactOpen(true)}>Contact</Button>
                      ) : (
                        <Button size="sm" onClick={() => setVerificationDialogOpen(true)}><Shield className="mr-1 h-3 w-3" />Verifieer</Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              <Tabs value={activeTab} onValueChange={(v) => go(v)} className="space-y-6">
                <TabsList className="sr-only" aria-hidden="true">
                  {OWNER_TABS.map(t => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
                </TabsList>

                {/* ===== OVERZICHT ===== */}
                <TabsContent value="overview" className="space-y-6">
                  {searchParams.get('welcome') === '1' && selectedRestaurant && (
                    <Card className="border-primary/30 bg-primary/5">
                      <CardContent className="p-5">
                        <p className="mb-1 text-lg font-semibold">Welkom, je bent nu de eigenaar van {selectedRestaurant.name}!</p>
                        <p className="text-sm text-muted-foreground">Loop de takenlijst hieronder na, dan zien gasten meteen de juiste informatie.</p>
                      </CardContent>
                    </Card>
                  )}
                  {selectedRestaurant && (
                    <DailyBriefing
                      restaurantName={selectedRestaurant.name}
                      ownerFirstName={ownerName}
                      totalViews={analytics?.totalViews || 0}
                      viewsByDay={analytics?.viewsByDay || []}
                      unansweredReviews={unansweredReviews}
                      suggestedDishes={suggestedDishCount}
                      isVerified={isVerified}
                      primaryActionLabel={!isVerified ? 'Verifieer nu' : unansweredReviews > 0 ? 'Beantwoord reviews' : suggestedDishCount > 0 ? 'Bevestig gerechten' : 'Bekijk inzichten'}
                      primaryActionHint={!isVerified ? 'Ontgrendel alle data en functies' : unansweredReviews > 0 ? 'Reageren verhoogt vertrouwen' : suggestedDishCount > 0 ? 'Word beter vindbaar' : 'Zie hoe gasten je vinden'}
                      onPrimaryAction={() => {
                        if (!isVerified) setVerificationDialogOpen(true);
                        else if (unansweredReviews > 0) go('reviews');
                        else if (suggestedDishCount > 0) go('menu');
                        else go('insights');
                      }}
                    />
                  )}
                  {selectedRestaurant && !selectedRestaurant.is_active && (
                    <OwnerHiddenNotice slug={selectedRestaurant.slug} onAddMenu={() => go('menu')} />
                  )}

                  <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                    <PageScoreCard tasks={tasks} onOpen={openTask} />
                    {selectedRestaurant && (
                      <PackagesSummary restaurantId={selectedRestaurant.id} isPro={isPro}
                        onManage={() => go('invoices')} onExplore={() => go('promotions')} />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
                    <StatCard variant="primary" title="Paginaweergaven (30d)" value={analytics?.totalViews ?? '—'} icon={Eye}
                      sparkline={(analytics?.viewsByDay || []).map(d => d.count)} />
                    <StatCard title="Vertoningen in resultaten" value={analytics?.impressions ?? '—'} icon={Search} />
                    <StatCard title="Route" value={analytics?.routeClicks ?? '—'} icon={MapPin} />
                    <StatCard title="Reserveren" value={analytics?.reservationClicks ?? '—'} icon={MousePointer} />
                    <StatCard title="Website" value={analytics?.websiteClicks ?? '—'} icon={Globe} />
                    <StatCard title="Telefoon" value={analytics?.phoneClicks ?? '—'} icon={Phone} />
                    <StatCard title="Totale kliks" value={analytics?.totalClicks ?? '—'} icon={MousePointer} />
                    <StatCard title="Kliks per weergave" icon={Gauge}
                      value={(() => { const p = safePercent(analytics?.totalClicks ?? 0, analytics?.totalViews ?? 0); return p === null ? '—' : `${p.toLocaleString('nl-NL')}%`; })()} />
                  </div>

                  <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
                    <Card>
                      <CardContent className="space-y-3 p-5">
                        <div className="flex items-center justify-between">
                          <h2 className="flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4 text-primary" />Laatste reviews
                            {unansweredReviews > 0 && <Badge variant="destructive" className="text-xs">{unansweredReviews} onbeantwoord</Badge>}
                          </h2>
                          <Button variant="link" size="sm" className="h-auto p-0" onClick={() => go('reviews')}>Alle reviews</Button>
                        </div>
                        {reviews.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nog geen reviews. Deel je pagina met gasten, reviews helpen je hoger in de resultaten.</p>
                        ) : (
                          <ul className="divide-y">
                            {reviews.slice(0, 3).map(rv => (
                              <li key={rv.id} className="flex items-start gap-3 py-3">
                                <Star className="mt-0.5 h-4 w-4 shrink-0 fill-rating text-rating" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium">{rv.rating} van 5{rv.profile?.name ? `, ${rv.profile.name}` : ''}</p>
                                  {(rv.title || rv.body) && <p className="line-clamp-2 text-sm text-muted-foreground">{rv.title || rv.body}</p>}
                                </div>
                                {!rv.owner_response && <Badge variant="outline" className="shrink-0 text-xs">Nog geen reactie</Badge>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="space-y-3 p-5">
                        <h2 className="flex items-center gap-2 font-semibold"><Rocket className="h-4 w-4 text-primary" />Promoties</h2>
                        <p className="text-sm text-muted-foreground">
                          Uitgelicht zet je bovenaan bij je gerechten. Daarnaast kun je extra tags, evenementen en een plek in de nieuwsbrief kiezen.
                        </p>
                        <Button variant="outline" size="sm" onClick={() => go('promotions')}>Bekijk promoties</Button>
                      </CardContent>
                    </Card>
                  </div>

                  {!isPro && selectedRestaurant && <ProUpsellBanner onSeeMore={() => go('insights')} />}
                </TabsContent>

                {/* ===== PROFIEL ===== */}
                <TabsContent value="profile" className="space-y-6">
                  <OwnerTabHeader icon={Store} title="Profiel" description="Alles wat gasten op je pagina zien. Rechts zie je hoe het eruitziet." />
                  {r && (
                    <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
                      <div className="min-w-0 space-y-8">
                        {isVerified ? (
                          <>
                            <ContactDetailsEditor restaurantId={r.id} restaurantName={r.name} phone={r.phone ?? null}
                              websiteUrl={r.website_url ?? null} address={r.address ?? null}
                              onSaved={(next) => setSelectedRestaurant({ ...r, ...next } as any)} />
                            {section('Naam, beschrijving en openingstijden', Clock, (
                              <>
                                <BasicInfoEditor restaurantId={r.id} currentName={r.name} currentOpeningHours={r.opening_hours}
                                  onHoursSaved={(opening_hours) => setSelectedRestaurant({ ...r, opening_hours } as any)} />
                                <div className="space-y-3">
                                  <h4 className="text-base font-semibold">Afwijkende dagen</h4>
                                  <OpeningHoursExceptions restaurantId={r.id} />
                                </div>
                              </>
                            ))}
                          </>
                        ) : (
                          <>
                            {locked('Gegevens bewerken', 'Verifieer dat je de eigenaar bent om contactgegevens, naam, beschrijving en openingstijden te bewerken.')}
                            {section('Afwijkende dagen', Clock, <OpeningHoursExceptions restaurantId={r.id} />)}
                          </>
                        )}

                        {section("Foto's", Image, isVerified ? (
                          <>
                            <p className="text-sm text-muted-foreground">Je foto's halen we automatisch op bij Google. Hier kun je ze vervangen of aanvullen. Met 3 of meer foto's word je vaker aangeklikt.</p>
                            <RestaurantImageUpload restaurantId={r.id} restaurantName={r.name} existingImages={r.images || []}
                              onImagesUpdate={() => toast.success("Foto's opgeslagen")} />
                          </>
                        ) : locked("Foto's beheren", "Vervang of voeg foto's toe aan je pagina."))}

                        {section('Faciliteiten en parkeren', Sparkles, (
                          <>
                            <Card>
                              <CardContent className="divide-y divide-border p-4">
                                <ToggleRow emoji="✓" emojiClass="text-green-600 font-bold" title="Volledig halal" description="Alle gerechten zijn halal"
                                  checked={r.is_fully_halal ?? false}
                                  onChange={(v) => saveToggle('is_fully_halal', v, ['Restaurant als halal gemarkeerd, alle gerechten bijgewerkt', 'Halal-markering verwijderd'], markDishes({ is_halal: true }))} />
                                <ToggleRow emoji="🥬" title="Volledig vegetarisch" description="Alle gerechten zijn vegetarisch"
                                  checked={r.is_fully_vegetarian ?? false}
                                  onChange={(v) => saveToggle('is_fully_vegetarian', v, ['Restaurant als vegetarisch gemarkeerd', 'Vegetarisch-markering verwijderd'], markDishes({ is_vegetarian: true }))} />
                                <ToggleRow emoji="🌱" title="Volledig veganistisch" description="Alle gerechten zijn veganistisch"
                                  checked={r.is_fully_vegan ?? false}
                                  onChange={(v) => saveToggle('is_fully_vegan', v, ['Restaurant als veganistisch gemarkeerd', 'Veganistisch-markering verwijderd'], markDishes({ is_vegan: true, is_vegetarian: true }))} />
                                <ToggleRow emoji="☀️" title="Terras" description="Gasten kunnen buiten zitten"
                                  checked={r.has_terrace ?? false} onChange={(v) => saveToggle('has_terrace', v, ['Terras aangezet', 'Terras uitgezet'])} />
                                <ToggleRow emoji="🚗" title="Bezorgen" description="Je bezorgt aan huis"
                                  checked={r.has_delivery ?? false} onChange={(v) => saveToggle('has_delivery', v, ['Bezorgen aangezet', 'Bezorgen uitgezet'])} />
                                <ToggleRow emoji="🥡" title="Afhalen" description="Gasten kunnen bestellen om mee te nemen"
                                  checked={r.has_takeaway ?? false} onChange={(v) => saveToggle('has_takeaway', v, ['Afhalen aangezet', 'Afhalen uitgezet'])} />
                              </CardContent>
                            </Card>
                            <ParkingEditor restaurantId={r.id} />
                          </>
                        ))}

                        {section('Social media', Instagram, isVerified ? (
                          <SocialLinksManager restaurantId={r.id} instagramUrl={r.instagram_url || ''} tiktokUrl={r.tiktok_url || ''}
                            onUpdate={(ig, tk) => setSelectedRestaurant({ ...r, instagram_url: ig, tiktok_url: tk } as any)} />
                        ) : locked('Social media koppelen', 'Koppel Instagram en TikTok zodat gasten je direct vanaf je pagina volgen.'))}

                        {isVerified && section('Meertalig profiel', Languages, (
                          <ProGate restaurantId={r.id} enforced>
                            <MultiLanguageProfile restaurantId={r.id} defaultName={r.name} />
                          </ProGate>
                        ))}

                        <p className="border-t pt-6 text-sm text-muted-foreground">
                          Tags zoals Vegan of Romantisch beheer je onder{' '}
                          <button type="button" className="font-medium text-primary underline" onClick={() => go('promotions')}>Promoties</button>.
                          Je reserveringsknop stel je in onder{' '}
                          <button type="button" className="font-medium text-primary underline" onClick={() => go('reservations')}>Reserveringen</button>.
                        </p>
                      </div>
                      <aside className="lg:sticky lg:top-[9.5rem]">
                        <PagePreviewCard slug={r.slug} name={r.name} cityName={cityName} cuisines={r.cuisines} tags={r.ambience_tags}
                          images={r.images} rating={Number(r.rating)} reviewCount={r.review_count} openingHours={r.opening_hours}
                          phone={r.phone} reservationUrl={r.reservation_url} isActive={!!r.is_active} />
                      </aside>
                    </div>
                  )}
                </TabsContent>

                {/* ===== MENU ===== */}
                <TabsContent value="menu" className="space-y-8">
                  <OwnerTabHeader icon={UtensilsCrossed} title="Menu"
                    description={`Gasten vinden je via je gerechten. Vanaf ${menuProgress?.minimum ?? 5} gerechten sta je volledig zichtbaar${menuProgress ? ` (nu ${menuProgress.count})` : ''}.`} />
                  {r ? (
                    <>
                      {section('Je gerechten', UtensilsCrossed, (
                        <>
                          {suggestedDishCount > 0 && <Badge variant="secondary" className="text-xs">{suggestedDishCount} voorgesteld, bevestig of wijs af</Badge>}
                          <DishConfirmation restaurantId={r.id} restaurantName={r.name} />
                        </>
                      ))}
                      {section('Menukaart en prijzen', FileText, (
                        <>
                          <p className="max-w-3xl text-sm text-muted-foreground">
                            Het snelst gaat het met <span className="font-medium text-foreground">Menu importeren</span>: upload je kaart als pdf of csv, wij herkennen de gerechten
                            en zetten ze bij je gerechten. Per gerecht houd je hieronder naam, categorie, prijs en dieetopties bij.
                          </p>
                          <OwnerMenuUpload restaurantId={r.id} restaurantName={r.name} />
                          <MenuItemsManager restaurantId={r.id} restaurantName={r.name} />
                        </>
                      ))}
                    </>
                  ) : null}
                </TabsContent>

                {/* ===== REVIEWS EN FEEDBACK ===== */}
                <TabsContent value="reviews" className="space-y-8">
                  <OwnerTabHeader icon={MessageSquare} title="Reviews en feedback"
                    description="Wat gasten over je zeggen. Een snel antwoord laat zien dat je luistert." />
                  {section(unansweredReviews > 0 ? `Reviews (${unansweredReviews} onbeantwoord)` : 'Reviews', Star, reviews.length > 0 ? (
                    <div className="space-y-6">
                      <ReviewIntelligence reviews={reviews} onApplyTemplate={(reviewId, text) => respondToReview(reviewId, text)} />
                      <div className="space-y-3">
                        {[...reviews].sort((a, b) => Number(!!a.owner_response) - Number(!!b.owner_response)).slice(0, reviewLimit).map(review => (
                          <ReviewCard key={review.id} review={review} onRespond={respondToReview} canRespond={isVerified}
                            restaurantId={selectedRestaurant?.id} restaurantName={selectedRestaurant?.name} />
                        ))}
                        {reviews.length > reviewLimit && (
                          <Button variant="outline" className="w-full" onClick={() => setReviewLimit(n => n + 10)}>
                            Toon meer ({reviews.length - reviewLimit})
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <Card className="border-dashed">
                      <CardContent className="mx-auto max-w-md py-10 text-center">
                        <p className="mb-1 text-sm font-medium">Nog geen reviews</p>
                        <p className="mb-4 text-xs text-muted-foreground">Deel je pagina met gasten. Reviews helpen je hoger in de zoekresultaten.</p>
                        {selectedRestaurant && (
                          <Button size="sm" variant="outline" asChild>
                            <Link to={`/restaurant/${selectedRestaurant.slug}`}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Bekijk je pagina</Link>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {r && isVerified && section('Antwoorden met AI en vaste teksten', Sparkles, (
                    <ProGate restaurantId={r.id} enforced><ResponseTemplatesManager restaurantId={r.id} /></ProGate>
                  ))}
                  {r && isVerified && section('Feedback van gasten aan tafel', QrCode, (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Met een QR-code op tafel of de rekening geven gasten direct feedback. Positieve gasten sturen we door naar je pagina, kritiek komt alleen bij jou binnen.
                      </p>
                      <ProGate restaurantId={r.id} enforced><QRCodeGenerator restaurantSlug={r.slug} restaurantName={r.name} /></ProGate>
                      <ProGate restaurantId={r.id} showBadge={false}><InternalFeedbackInbox restaurantId={r.id} /></ProGate>
                    </>
                  ))}
                </TabsContent>

                {/* ===== RESERVERINGEN ===== */}
                <TabsContent value="reservations" className="space-y-8">
                  <OwnerTabHeader icon={CalendarCheck} title="Reserveringen"
                    description="Kies hoe gasten bij je reserveren. De Reserveren-knop op je pagina gebruikt wat je hier instelt." />
                  {r && (
                    <>
                      <Card>
                        <CardContent className="p-4">
                          <ToggleRow emoji="📅" title="Je neemt reserveringen aan" description="Uit: de Reserveren-knop verdwijnt van je pagina"
                            checked={r.accepts_reservations ?? false}
                            onChange={(v) => saveToggle('accepts_reservations', v, ['Reserveringen aangezet', 'Reserveringen uitgezet'])} />
                        </CardContent>
                      </Card>
                      {section('Reserveringslink', Link2, (
                        <ReservationLinkManager restaurantId={r.id} reservationUrl={r.reservation_url || ''} hasWebsite={!!r.website_url}
                          onUpdate={(url) => setSelectedRestaurant({ ...r, reservation_url: url, accepts_reservations: !!url } as any)}
                          onOpenIntegrations={() => document.getElementById('reservation-systems')?.scrollIntoView({ behavior: 'smooth' })} />
                      ))}
                      {section('Reserveringssysteem koppelen', Plug, isVerified ? (
                        <>
                          <ReservationIntegrations restaurantId={r.id} />
                          <ReservationStatsCard restaurantId={r.id} />
                        </>
                      ) : locked('Reserveringssysteem koppelen', 'Koppel bijvoorbeeld Zenchef, zodat gasten direct vanaf je Dishloopr-pagina reserveren.'), 'reservation-systems')}
                    </>
                  )}
                </TabsContent>

                {/* ===== INZICHTEN (incl. Markt) ===== */}
                <TabsContent value="insights" className="space-y-6">
                  <OwnerTabHeader icon={BarChart3} title="Inzichten" description="Hoe gasten je vinden en hoe je het doet ten opzichte van de buurt."
                    actions={isVerified && selectedRestaurant ? <InsightsExportButton restaurantId={selectedRestaurant.id} restaurantName={selectedRestaurant.name} /> : undefined} />
                  <Tabs value={insightsTab} onValueChange={setInsightsTab}>
                    <TabsList>
                      <TabsTrigger value="visitors">Bezoekers en gerechten</TabsTrigger>
                      <TabsTrigger value="market">Markt</TabsTrigger>
                    </TabsList>
                    <TabsContent value="visitors" className="pt-4">
                      {!isPro && selectedRestaurant ? (
                        <ProPaywall featureName="Inzichten" description="Begrijp precies hoe gasten je vinden, wat ze zoeken en waar je groei laat liggen." previewVariant="insights"
                          benefits={[
                            'Weergaven, kliks en conversies per dag',
                            'Je zoekpositie en de zoektermen waarop je gevonden wordt',
                            'Conversie-funnel met melding bij plotselinge dalingen',
                            'Wekelijkse aanbevelingen op basis van je cijfers',
                            'Kanalen en vergelijking met vorig jaar',
                            'Gerechten-analyse en optimalisatietips',
                            'Alles exporteren naar csv of pdf',
                          ]} />
                      ) : isVerified && r ? (
                        <div className="space-y-8">
                          {section('Prestaties', BarChart3, <AnalyticsTab analytics={analytics} restaurant={r} reviews={reviews} />)}
                          {section('Zoekpositie', TrendingUp, <SearchRanking restaurantId={r.id} restaurantName={r.name} />)}
                          {section('Conversie en zoektermen', BarChart3, (
                            <ProGate restaurantId={r.id} enforced>
                              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <OwnerFunnel restaurantId={r.id} />
                                <SearchTermHeatmap restaurantId={r.id} />
                              </div>
                            </ProGate>
                          ))}
                          {section('Groei-inzichten', TrendingUp, <ProGate restaurantId={r.id} enforced><ProGrowthInsights restaurantId={r.id} /></ProGate>)}
                          {section('Aanbevelingen en meldingen', Sparkles, (
                            <ProGate restaurantId={r.id} enforced>
                              <div className="space-y-6"><FunnelAnomalies restaurantId={r.id} /><WeeklyRecommendations restaurantId={r.id} /></div>
                            </ProGate>
                          ))}
                          {section('Hoe gasten je vinden', BarChart3, <ProGate restaurantId={r.id} enforced><ChannelAttribution restaurantId={r.id} /></ProGate>)}
                          {section('Vergeleken met vorig jaar', TrendingUp, <HistoricalBenchmark restaurantId={r.id} />)}
                          {section('Wanneer gasten zoeken', Clock, <ProGate restaurantId={r.id} enforced><BestTimeToPost restaurantId={r.id} /></ProGate>)}
                          {section('Gerechten', UtensilsCrossed, <DishAnalytics restaurantId={r.id} restaurantName={r.name} />)}
                          {section('Optimalisatie', Gauge, <OptimizationDashboard restaurantId={r.id} restaurantName={r.name} />)}
                        </div>
                      ) : locked('Inzichten', 'Bekijk statistieken, gerechten-analyse en optimalisatietips.')}
                    </TabsContent>
                    <TabsContent value="market" className="pt-4">
                      {!isPro && selectedRestaurant ? (
                        <ProPaywall featureName="Markt" description="Zie hoe je het doet ten opzichte van restaurants in je buurt en stad." previewVariant="market"
                          benefits={[
                            'Buurtanalyse: rating, reviews en prijsniveau van directe concurrenten',
                            'Vergelijking op keuken, stad en prijsklasse',
                            'Piekuren en piekdagen op basis van echte zoekvraag',
                            'Welke gasten je verliest aan concurrenten',
                            'Wat je promoties opleveren',
                          ]} />
                      ) : isVerified && r ? (
                        <div className="space-y-8">
                          {section('Buurtanalyse', BarChart3, (
                            <NeighborhoodAnalysis competitors={competitors} myRating={r.rating} myReviewCount={r.review_count} myName={r.name} />
                          ))}
                          {section('Vergelijking met je stad', TrendingUp, (
                            <CompetitorBenchmark restaurantId={r.id} cityId={r.city_id} cuisines={r.cuisines || []}
                              rating={Number(r.rating)} reviewCount={r.review_count} />
                          ))}
                          {section('Verloren aan concurrenten', TrendingUp, <ProGate restaurantId={r.id} enforced><LostToCompetitor restaurantId={r.id} /></ProGate>)}
                          {section('Piekuren', Clock, <PeakHoursInsight peakHours={peakHours} peakDays={peakDays} />)}
                          {section('Wat je promoties opleveren', Crown, <PromotionROI promotions={promotionROI} />)}
                        </div>
                      ) : locked('Markt', 'Vergelijk je prestaties met restaurants in je buurt.')}
                    </TabsContent>
                  </Tabs>
                </TabsContent>

                {/* ===== PROMOTIES ===== */}
                <TabsContent value="promotions" className="space-y-8">
                  <OwnerTabHeader icon={Rocket} title="Promoties"
                    description="Alles wat je extra zichtbaar maakt. Uitgelicht is het hoofdpakket, daarnaast kies je losse extra's." />
                  {r && (
                    <>
                      {section('Uitgelicht', Crown, (
                        <MyPackagesCard restaurantId={r.id} restaurantSlug={r.slug} restaurantName={r.name} />
                      ))}
                      {section('Tags', Tag, (
                        <>
                          <p className="text-sm text-muted-foreground">Met tags verschijn je bij filters zoals Vegan of Romantisch. Eén tag is gratis, extra tags kosten €5 per maand.</p>
                          <TagManager restaurant={r} onUpdate={(updated) => setSelectedRestaurant(updated)} />
                          <TagRequestForm restaurantId={r.id} />
                        </>
                      ))}
                      {section('Evenementen en specials', PartyPopper, isVerified ? (
                        <div className="space-y-6">
                          <p className="text-sm text-muted-foreground">Een proeverij, kerstmenu of live muziek komt in de eventlijst van je stad en op je pagina, voor €5 per maand per evenement.</p>
                          <OwnerEventsManager restaurantId={r.id} restaurantName={r.name} />
                          <EventsCalendarView restaurantId={r.id} />
                        </div>
                      ) : locked('Evenementen', 'Zet specials en evenementen op Dishloopr voor €5 per maand per evenement.'))}
                      {section('Nieuwsbrief', Megaphone, <NewsletterPlacement restaurantId={r.id} restaurantName={r.name} />, 'promo-newsletter')}
                      {section('Gerecht in de spotlight', Star, <SponsoredMarketplace restaurantId={r.id} restaurantName={r.name} />, 'promo-sponsored')}

                      <div className="border-t pt-8">
                        <h2 className="font-display text-xl font-bold">Gasten terug laten komen</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Kortingen, acties en loyalty voor gasten die je al kennen.</p>
                      </div>
                      {section('Kortingscodes en acties', Ticket, (
                        <div className="space-y-6">
                          <PromoCodesManager restaurantId={r.id} />
                          {isVerified && <ProGate restaurantId={r.id} enforced><DealsManager restaurantId={r.id} /></ProGate>}
                        </div>
                      ))}
                      {section('Social posts maken', Sparkles, <ProGate restaurantId={r.id} enforced><SocialPostGenerator restaurantName={r.name} /></ProGate>)}
                      {section('Stempelkaart en loyalty', Crown, <ProGate restaurantId={r.id} enforced><LoyaltyProgramManager restaurantId={r.id} /></ProGate>)}
                      {section('Samenwerken met andere restaurants', Store, <ProGate restaurantId={r.id} enforced><CrossPromotionManager restaurantId={r.id} /></ProGate>)}
                      {isVerified && section('Vraag doorsturen', Zap, <DemandRoutingSettings restaurant={r} />)}
                      {!isPro && <div className="border-t pt-8"><UpgradeToProCard restaurantId={r.id} /></div>}
                    </>
                  )}
                </TabsContent>

                {/* ===== INSTELLINGEN EN PAKKETTEN ===== */}
                <TabsContent value="settings" className="space-y-6">
                  <OwnerTabHeader icon={Settings} title="Instellingen en pakketten" description="Je account, meldingen, team en alles wat je betaalt." />
                  <Tabs value={settingsTab} onValueChange={setSettingsTab}>
                    <TabsList className="flex h-auto flex-wrap justify-start">
                      <TabsTrigger value="account">Account</TabsTrigger>
                      <TabsTrigger value="notifications">Meldingen</TabsTrigger>
                      <TabsTrigger value="team">Team</TabsTrigger>
                      <TabsTrigger value="billing">Pakketten en facturen</TabsTrigger>
                    </TabsList>
                    <TabsContent value="account" className="pt-4">
                      <AccountSettings onNameSaved={(n) => setOwnerName(ownerFirstName({ profileName: n }))} />
                    </TabsContent>
                    <TabsContent value="notifications" className="space-y-4 pt-4">
                      <WeeklyReportToggle />
                      <AnomalyAlertToggle isPro={isPro} />
                      <EventReportToggle />
                    </TabsContent>
                    <TabsContent value="team" className="pt-4">
                      {r && isVerified ? (
                        <ProGate restaurantId={r.id} enforced><TeamMembersManager restaurantId={r.id} /></ProGate>
                      ) : locked('Team', 'Nodig collega\'s uit om je pagina mee te beheren.')}
                    </TabsContent>
                    <TabsContent value="billing" className="space-y-6 pt-4">
                      {r && <PackagesSummary restaurantId={r.id} isPro={isPro} onExplore={() => go('promotions')} />}
                      <InvoicesTab />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              </Tabs>
            </div>

            {selectedRestaurant && (
              <VerificationRequiredDialog
                open={verificationDialogOpen}
                onOpenChange={setVerificationDialogOpen}
                claimId={activeClaimId}
                restaurantId={selectedRestaurant.id}
                restaurantName={selectedRestaurant.name}
                restaurantWebsite={selectedRestaurant.website_url}
                onVerificationComplete={() => { loadPermissions(); setVerificationDialogOpen(false); }}
              />
            )}
            <OwnerTour userId={user?.id} />
          </div>
        </div>
      </SidebarProvider>
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
