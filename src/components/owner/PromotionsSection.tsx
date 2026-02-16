import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sparkles, Crown, Lock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PromotionsSectionProps {
  restaurant: any;
  onRefresh: () => void;
  canPurchase: boolean;
}

export function PromotionsSection({ restaurant, onRefresh, canPurchase }: PromotionsSectionProps) {
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
        body: { listingType, restaurantId: restaurant.id },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, '_blank');
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
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Uitgelicht op de homepage</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Speciale badge bij je restaurant</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />+50% meer zichtbaarheid</li>
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
                  <Button onClick={() => handlePurchase('featured')} disabled={loadingType !== null || !canPurchase}>
                    {loadingType === 'featured' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Bovenaan alle zoekresultaten</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Premium badge</li>
                <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />+100% meer zichtbaarheid</li>
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
                  <Button onClick={() => handlePurchase('top')} disabled={loadingType !== null || !canPurchase}>
                    {loadingType === 'top' && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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
            <p className="text-sm text-muted-foreground">Beide opties zijn 30 dagen geldig vanaf het moment van aankoop.</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Kan ik beide opties combineren?</h4>
            <p className="text-sm text-muted-foreground">Ja! Je kunt zowel Featured als Top Listing tegelijk actief hebben voor maximale zichtbaarheid.</p>
          </div>
          <div>
            <h4 className="font-medium mb-1">Hoe betaal ik?</h4>
            <p className="text-sm text-muted-foreground">We accepteren iDEAL, creditcard en Bancontact via onze beveiligde betaalomgeving.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
