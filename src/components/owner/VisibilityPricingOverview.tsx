import { Sparkles, Crown, Rocket, Mail, ChefHat, MapPin, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useFeaturedMarketplace } from '@/hooks/useFeaturedMarketplace';

/**
 * Compacte prijslijst bovenaan de Promoties-tab zodat eigenaren in één
 * oogopslag zien wat alle zichtbaarheidsproducten kosten en waar ze ze
 * activeren.
 */
export function VisibilityPricingOverview() {
  const { ambiancePricing } = useFeaturedMarketplace();

  return (
    <Card className="border-primary/30 overflow-hidden">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-b border-primary/20 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground inline-flex items-center justify-center shrink-0">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">Zo word je zichtbaarder</h3>
            <p className="text-sm text-muted-foreground">
              Alle promotie-opties op één plek — kies wat past en activeer in de blokken hieronder.
            </p>
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {/* Premium plek */}
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Premium plek (Featured)</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Vast plekje per <strong>stad + keuken</strong> in zoekresultaten. Marktprijs schommelt
              op basis van vraag en beschikbaarheid.
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">vanaf €99</span>
              <span className="text-xs text-muted-foreground">/maand</span>
            </div>
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <Info className="h-3 w-3" /> Activeer hieronder bij <em>Premium Zichtbaarheid</em>
            </p>
          </div>

          {/* Ambiance add-on */}
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Ambiance add-ons</h4>
              <Badge variant="outline" className="text-[10px]">doorlopend</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Word ook gevonden op sfeer (romantisch, trendy, business…). 1e tag <strong>gratis</strong>,
              extra tags maandelijks opzegbaar.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ambiancePricing.map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 text-[11px] bg-muted px-2 py-0.5 rounded-full"
                >
                  <span className="capitalize">{a.ambiance_tag}</span>
                  <span className="font-semibold text-foreground">€{a.monthly_price}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Listing boosts */}
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Listing boosts (eenmalig)</h4>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between"><span>Featured Listing — 30 dagen</span><strong className="text-foreground">€49</strong></div>
              <div className="flex justify-between"><span>Top Listing — 30 dagen</span><strong className="text-foreground">€99</strong></div>
            </div>
            <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <Info className="h-3 w-3" /> Bij <em>Promoties &amp; Listings</em>
            </p>
          </div>

          {/* Newsletter + sponsored */}
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-sm">Nieuwsbrief &amp; gerecht</h4>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between"><span>Stadseditie nieuwsbrief</span><strong className="text-foreground">€15</strong></div>
              <div className="flex justify-between"><span>Provincie nieuwsbrief</span><strong className="text-foreground">€20</strong></div>
              <div className="flex justify-between"><span>Landelijk nieuwsbrief</span><strong className="text-foreground">€40</strong></div>
              <div className="flex justify-between items-center pt-1 border-t mt-1">
                <span className="inline-flex items-center gap-1"><ChefHat className="h-3 w-3" /> Sponsor 1 gerecht</span>
                <strong className="text-foreground">per dag</strong>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}