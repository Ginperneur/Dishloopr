import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, MapPin, UtensilsCrossed, Clock, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSponsoredProducts, useSponsoredPurchases } from '@/hooks/useSponsoredProducts';
import { toast } from 'sonner';

interface SponsoredMarketplaceProps {
  restaurantId: string;
  restaurantName: string;
}

export function SponsoredMarketplace({ restaurantId, restaurantName }: SponsoredMarketplaceProps) {
  const { products, loading, calculatePrice, purchaseSlot } = useSponsoredProducts();
  const { purchases, loading: purchasesLoading, fetchPurchases } = useSponsoredPurchases(restaurantId);
  
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [duration, setDuration] = useState(30);
  const [priceInfo, setPriceInfo] = useState<any>(null);
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Active purchases for this restaurant
  const activePurchases = purchases.filter(p => 
    p.is_active && new Date(p.expires_at) > new Date()
  );

  const handleSelectProduct = async (product: any) => {
    setSelectedProduct(product);
    setDuration(product.default_duration_days);
    setDialogOpen(true);
    await fetchPrice(product.dish_id, product.city_id, product.default_duration_days);
  };

  const fetchPrice = async (dishId: string, cityId: string, days: number) => {
    setLoadingPrice(true);
    const result = await calculatePrice(dishId, cityId, days);
    setPriceInfo(result);
    setLoadingPrice(false);
  };

  const handleDurationChange = async (value: number[]) => {
    const newDuration = value[0];
    setDuration(newDuration);
    if (selectedProduct) {
      await fetchPrice(selectedProduct.dish_id, selectedProduct.city_id, newDuration);
    }
  };

  const handlePurchase = async () => {
    if (!selectedProduct) return;

    setPurchasing(true);
    const checkoutUrl = await purchaseSlot(selectedProduct.id, restaurantId, duration);
    
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank');
      setDialogOpen(false);
    } else {
      toast.error('Kon checkout niet starten');
    }
    
    setPurchasing(false);
  };

  // Check if already has purchase for this product
  const hasExistingPurchase = (productId: string) => {
    return activePurchases.some(p => p.product_id === productId);
  };

  return (
    <div className="space-y-6">
      {/* Active Sponsorings */}
      {activePurchases.length > 0 && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              Actieve Sponsorings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {activePurchases.map(purchase => (
                <div key={purchase.id} className="flex items-center justify-between p-3 rounded-lg bg-background border">
                  <div>
                    <p className="font-medium">
                      {(purchase.sponsored_products as any)?.dishes?.name} in {(purchase.sponsored_products as any)?.cities?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Actief tot {new Date(purchase.expires_at).toLocaleDateString('nl-NL')}
                    </p>
                  </div>
                  <Badge className="bg-green-500">Actief</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Sponsoring Marketplace
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Koop exclusieve zichtbaarheid voor specifieke gerechten in specifieke steden
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Er zijn momenteel geen sponsored producten beschikbaar.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map(product => {
                const hasPurchase = hasExistingPurchase(product.id);
                const slotsAvailable = (product.available_slots ?? product.max_slots) > 0;
                
                return (
                  <motion.div
                    key={product.id}
                    whileHover={{ scale: slotsAvailable && !hasPurchase ? 1.02 : 1 }}
                    className={`p-4 rounded-xl border-2 transition-colors ${
                      hasPurchase 
                        ? 'border-green-500/30 bg-green-500/5' 
                        : slotsAvailable 
                          ? 'border-border hover:border-primary/50' 
                          : 'border-muted bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <UtensilsCrossed className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{(product.dishes as any)?.name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {(product.cities as any)?.name}
                        </div>
                      </div>
                      <Badge variant={slotsAvailable ? 'secondary' : 'destructive'}>
                        {product.available_slots}/{product.max_slots} slots
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold">Vanaf €{Number(product.base_price).toFixed(0)}</span>
                        <span className="text-sm text-muted-foreground"> / 30d</span>
                      </div>
                      
                      {hasPurchase ? (
                        <Badge className="bg-green-500">Al gekocht</Badge>
                      ) : slotsAvailable ? (
                        <Button size="sm" onClick={() => handleSelectProduct(product)}>
                          Bekijk
                        </Button>
                      ) : (
                        <Button size="sm" disabled variant="secondary">
                          Vol
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Purchase Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Sponsored Listing Kopen
            </DialogTitle>
            <DialogDescription>
              Vergroot de zichtbaarheid van {restaurantName}
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-6">
              {/* Product Info */}
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <UtensilsCrossed className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{(selectedProduct.dishes as any)?.name}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {(selectedProduct.cities as any)?.name}
                </div>
              </div>

              {/* Duration Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Duur
                  </Label>
                  <span className="font-semibold">{duration} dagen</span>
                </div>
                <Slider
                  value={[duration]}
                  onValueChange={handleDurationChange}
                  min={selectedProduct.min_duration_days}
                  max={selectedProduct.max_duration_days}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Min: {selectedProduct.min_duration_days} dagen, Max: {selectedProduct.max_duration_days} dagen
                </p>
              </div>

              {/* Price Display */}
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                {loadingPrice ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Prijs berekenen...</span>
                  </div>
                ) : priceInfo ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-muted-foreground">Totaalprijs</span>
                      <span className="text-2xl font-bold text-primary">
                        €{priceInfo.price.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Populariteitsniveau: {priceInfo.breakdown.popularityTier}</p>
                      <p>Zoekopdrachten: {priceInfo.breakdown.searchCount}</p>
                      <p>Restaurants in stad: {priceInfo.breakdown.restaurantCount}</p>
                    </div>
                  </>
                ) : null}
              </div>

              {/* What You Get */}
              <div className="space-y-2">
                <p className="font-medium text-sm">Wat krijg je:</p>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    "Uitgelicht" label bij zoekresultaten
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Hogere positie in relevante zoekopdrachten
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Exclusieve slot (max {selectedProduct.max_slots} per gerecht/stad)
                  </li>
                </ul>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Sponsored listings beïnvloeden nooit reviews of populariteitsscores.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handlePurchase} 
                disabled={purchasing || loadingPrice}
                className="w-full"
              >
                {purchasing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Laden...
                  </>
                ) : (
                  `Koop voor €${priceInfo?.price?.toFixed(2) || '...'}`
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
