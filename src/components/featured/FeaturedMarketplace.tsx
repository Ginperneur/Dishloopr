import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  TrendingUp, 
  Clock, 
  MapPin, 
  ChefHat,
  Users,
  Info,
  CheckCircle2,
  AlertCircle,
  Timer,
  Plus,
  Minus
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useFeaturedMarketplace, useFeaturedSubscriptions } from '@/hooks/useFeaturedMarketplace';

interface FeaturedMarketplaceProps {
  restaurantId: string;
  restaurantName: string;
  restaurantCuisines: string[];
  cityId: string;
  cityName: string;
}

interface MarketPricing {
  slot_id?: string;
  base_price: number;
  final_price: number;
  demand_multiplier: number;
  active_count: number;
  max_slots: number;
  occupancy_rate: number;
  price_reason: string;
}

export function FeaturedMarketplace({ 
  restaurantId, 
  restaurantName,
  restaurantCuisines,
  cityId,
  cityName 
}: FeaturedMarketplaceProps) {
  const { t } = useTranslation();
  const { 
    ambiancePricing, 
    getMarketPrice, 
    checkEligibility,
    createCheckout,
    calculateTotalPrice,
    joinWaitlist 
  } = useFeaturedMarketplace();
  const { subscriptions, loading: subsLoading, refetch } = useFeaturedSubscriptions(restaurantId);

  const [selectedCuisine, setSelectedCuisine] = useState<string>('');
  const [marketPricing, setMarketPricing] = useState<MarketPricing | null>(null);
  const [eligibility, setEligibility] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  
  // Purchase configuration
  const [durationMonths, setDurationMonths] = useState(1);
  const [includedAmbiance, setIncludedAmbiance] = useState<string | null>(null);
  const [extraAmbiances, setExtraAmbiances] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (restaurantCuisines.length > 0 && !selectedCuisine) {
      setSelectedCuisine(restaurantCuisines[0]);
    }
  }, [restaurantCuisines]);

  useEffect(() => {
    if (selectedCuisine && cityId) {
      fetchMarketData();
    }
  }, [selectedCuisine, cityId]);

  const fetchMarketData = async () => {
    setLoading(true);
    try {
      const [pricing, eligibilityData] = await Promise.all([
        getMarketPrice(cityId, selectedCuisine),
        checkEligibility(restaurantId, cityId, selectedCuisine)
      ]);
      
      setMarketPricing(pricing);
      setEligibility(eligibilityData);
    } catch (err) {
      console.error('Error fetching market data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPurchase = () => {
    setDurationMonths(1);
    setIncludedAmbiance(null);
    setExtraAmbiances([]);
    setPurchaseDialogOpen(true);
  };

  const handleAmbianceToggle = (tag: string) => {
    if (!includedAmbiance) {
      // First one is free
      setIncludedAmbiance(tag);
    } else if (includedAmbiance === tag) {
      // Deselect included
      setIncludedAmbiance(null);
    } else if (extraAmbiances.includes(tag)) {
      // Remove from extras
      setExtraAmbiances(prev => prev.filter(a => a !== tag));
    } else {
      // Add to extras (max 3 extra)
      if (extraAmbiances.length < 3) {
        setExtraAmbiances(prev => [...prev, tag]);
      } else {
        toast.error('Maximaal 3 extra ambiance tags');
      }
    }
  };

  const handlePurchase = async () => {
    if (!eligibility?.slotId || !marketPricing) return;

    setIsProcessing(true);
    try {
      const url = await createCheckout(
        restaurantId,
        eligibility.slotId,
        includedAmbiance,
        extraAmbiances,
        durationMonths
      );

      if (url) {
        window.open(url, '_blank');
        setPurchaseDialogOpen(false);
        toast.success('Je wordt doorgestuurd naar de betaalpagina...');
      } else {
        throw new Error('Kon geen checkout sessie aanmaken');
      }
    } catch (err) {
      toast.error('Er ging iets mis bij het aanmaken van de betaling');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!eligibility?.slotId) return;

    setIsProcessing(true);
    try {
      const result = await joinWaitlist(restaurantId, eligibility.slotId, [
        ...(includedAmbiance ? [includedAmbiance] : []),
        ...extraAmbiances
      ]);

      if (result.success) {
        toast.success(`Je staat nu op positie ${result.position} van de wachtlijst`);
        setPurchaseDialogOpen(false);
        fetchMarketData();
      } else {
        throw new Error('Kon niet toevoegen aan wachtlijst');
      }
    } catch (err) {
      toast.error('Er ging iets mis');
    } finally {
      setIsProcessing(false);
    }
  };

  const priceBreakdown = marketPricing 
    ? calculateTotalPrice(marketPricing.final_price, extraAmbiances, durationMonths)
    : { monthly: 0, total: 0, ambianceAddon: 0 };

  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Premium Zichtbaarheid</h2>
          <p className="text-sm text-muted-foreground">
            Verhoog je marktpositie met beperkte premium plekken
          </p>
        </div>
      </div>

      {/* Active Subscriptions */}
      {activeSubscriptions.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Actieve Premium Plekken
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeSubscriptions.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between p-3 rounded-lg bg-background">
                <div>
                  <p className="font-medium">
                    {sub.featured_slots?.cuisine} in {sub.featured_slots?.cities?.name}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Timer className="h-3 w-3" />
                    <span>
                      Verloopt {new Date(sub.expires_at).toLocaleDateString('nl-NL')}
                    </span>
                    <span className="mx-1">•</span>
                    <span>{sub.consecutive_months}/3 maanden</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">€{sub.total_monthly_price}/maand</p>
                  <p className="text-xs text-muted-foreground">
                    {sub.total_views} views • {sub.total_clicks} clicks
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Cuisine Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kies je categorie</CardTitle>
          <CardDescription>
            Selecteer de keuken waarvoor je premium zichtbaarheid wilt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {restaurantCuisines.map((cuisine) => (
              <Button
                key={cuisine}
                variant={selectedCuisine === cuisine ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCuisine(cuisine)}
              >
                <ChefHat className="h-4 w-4 mr-1" />
                {cuisine}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Market Overview */}
      {marketPricing && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {selectedCuisine} in {cityName}
                  </CardTitle>
                  <CardDescription>
                    Marktoverzicht voor deze categorie
                  </CardDescription>
                </div>
                <Badge 
                  variant={marketPricing.occupancy_rate >= 70 ? 'destructive' : 'secondary'}
                  className="text-sm"
                >
                  {marketPricing.active_count}/{marketPricing.max_slots} plekken bezet
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Slot Availability */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Beschikbaarheid</span>
                  <span className="font-medium">{marketPricing.occupancy_rate}% bezet</span>
                </div>
                <Progress 
                  value={marketPricing.occupancy_rate} 
                  className="h-2"
                />
              </div>

              <Separator />

              {/* Pricing */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Huidige marktprijs</p>
                  <p className="text-2xl font-bold">€{marketPricing.final_price}</p>
                  <p className="text-xs text-muted-foreground">per maand</p>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground cursor-help">
                        <Info className="h-4 w-4" />
                        Waarom deze prijs?
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>{marketPricing.price_reason}</p>
                      {marketPricing.demand_multiplier > 1 && (
                        <p className="mt-1 text-xs">
                          Vraagfactor: {marketPricing.demand_multiplier.toFixed(2)}x
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Eligibility Status */}
              {eligibility && (
                <div className="pt-4">
                  {eligibility.inCoolingOff ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
                      <Clock className="h-5 w-5" />
                      <div>
                        <p className="font-medium">Afkoelperiode actief</p>
                        <p className="text-sm opacity-80">
                          Na 3 maanden uitlichten is een pauze verplicht
                        </p>
                      </div>
                    </div>
                  ) : eligibility.hasActiveSubscription ? (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary">
                      <CheckCircle2 className="h-5 w-5" />
                      <div>
                        <p className="font-medium">Je hebt al een actieve plek</p>
                        <p className="text-sm opacity-80">
                          Beheer je bestaande premium plek hierboven
                        </p>
                      </div>
                    </div>
                  ) : eligibility.isFull ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
                        <Users className="h-5 w-5" />
                        <div>
                          <p className="font-medium">Alle plekken bezet</p>
                          <p className="text-sm opacity-80">
                            {eligibility.waitlistPosition 
                              ? `Je staat op positie ${eligibility.waitlistPosition}`
                              : 'Schrijf je in voor de wachtlijst'
                            }
                          </p>
                        </div>
                      </div>
                      {!eligibility.waitlistPosition && (
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={handleOpenPurchase}
                        >
                          Inschrijven voor wachtlijst
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handleOpenPurchase}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Claim je premium plek
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Purchase Dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Premium Plek Configureren
            </DialogTitle>
            <DialogDescription>
              {selectedCuisine} in {cityName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Duration Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Looptijd</Label>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDurationMonths(Math.max(1, durationMonths - 1))}
                  disabled={durationMonths <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="text-center min-w-[120px]">
                  <p className="text-2xl font-bold">{durationMonths}</p>
                  <p className="text-sm text-muted-foreground">
                    {durationMonths === 1 ? 'maand' : 'maanden'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDurationMonths(Math.min(3, durationMonths + 1))}
                  disabled={durationMonths >= 3}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Maximum 3 maanden aaneengesloten, daarna verplichte pauze
              </p>
            </div>

            <Separator />

            {/* Ambiance Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Ambiance tags</Label>
                <Badge variant="outline" className="text-xs">
                  1 inbegrepen, extra = €/maand
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ambiancePricing.map((ambiance) => {
                  const isIncluded = includedAmbiance === ambiance.ambiance_tag;
                  const isExtra = extraAmbiances.includes(ambiance.ambiance_tag);
                  const isSelected = isIncluded || isExtra;

                  return (
                    <div
                      key={ambiance.id}
                      className={`
                        flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors
                        ${isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                        }
                      `}
                      onClick={() => handleAmbianceToggle(ambiance.ambiance_tag)}
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox checked={isSelected} />
                        <span className="text-sm capitalize">{ambiance.ambiance_tag}</span>
                      </div>
                      {isIncluded ? (
                        <Badge variant="secondary" className="text-xs">Gratis</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          +€{ambiance.monthly_price}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Price Breakdown */}
            <div className="space-y-2 p-4 rounded-lg bg-muted/50">
              <div className="flex justify-between text-sm">
                <span>Basisplek ({selectedCuisine})</span>
                <span>€{marketPricing?.final_price || 0}/maand</span>
              </div>
              {priceBreakdown.ambianceAddon > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Extra ambiance tags ({extraAmbiances.length}x)</span>
                  <span>€{priceBreakdown.ambianceAddon}/maand</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-medium">
                <span>Maandelijks totaal</span>
                <span>€{priceBreakdown.monthly}</span>
              </div>
              <div className="flex justify-between text-lg font-bold text-primary">
                <span>Te betalen ({durationMonths} {durationMonths === 1 ? 'maand' : 'maanden'})</span>
                <span>€{priceBreakdown.total.toFixed(2)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPurchaseDialogOpen(false)}
              >
                Annuleren
              </Button>
              {eligibility?.isFull ? (
                <Button
                  className="flex-1"
                  onClick={handleJoinWaitlist}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Even geduld...' : 'Inschrijven wachtlijst'}
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  onClick={handlePurchase}
                  disabled={isProcessing}
                >
                  {isProcessing ? 'Even geduld...' : 'Doorgaan naar betaling'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
