import { Crown, Check, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOwnerTier } from '@/hooks/useOwnerTier';
import { useOwnerProCheckout } from '@/hooks/useOwnerProCheckout';
import { OWNER_PRO_PRICES } from '@/lib/proPricing';
import { CHECKOUT_ENABLED, COMING_SOON_LABEL } from '@/lib/checkoutFlags';

const PRO_BENEFITS = [
  'Conversie-funnel & zoektermen-heatmap',
  'AI antwoord-assistent voor reviews',
  'Team-beheer & medewerker-rollen',
  'Interne gast-feedback via QR',
  'Concurrent benchmark & marktinzicht',
  'AI Social-post Generator',
  'Loyalty stempelkaart',
];

export function UpgradeToProCard({ restaurantId }: { restaurantId: string }) {
  const { data: tier } = useOwnerTier(restaurantId);
  const { startCheckout, loading } = useOwnerProCheckout();
  if (tier === 'pro') return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/10 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Crown className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-base mb-1">Upgrade naar Dishloopr Pro</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Ontgrendel geavanceerde analytics, AI-tools en marketingfuncties om meer gasten te bereiken.
            </p>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4 text-sm">
              <span className="font-semibold text-foreground">{OWNER_PRO_PRICES.monthly.label}</span>
              <span className="text-muted-foreground">of {OWNER_PRO_PRICES.yearly.label}</span>
              <span className="text-primary text-xs font-medium">
                ({OWNER_PRO_PRICES.yearly.savingsLabel})
              </span>
            </div>
            <ul className="space-y-1.5 mb-4">
              {PRO_BENEFITS.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                className="flex-1 sm:flex-none"
                onClick={() => startCheckout('monthly')}
                disabled={loading !== null || !CHECKOUT_ENABLED.pro}
                title={!CHECKOUT_ENABLED.pro ? COMING_SOON_LABEL : undefined}
              >
                {loading === 'monthly' ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Crown className="h-4 w-4 mr-1" />
                )}
                {CHECKOUT_ENABLED.pro ? 'Maandelijks · €29' : `Maandelijks · ${COMING_SOON_LABEL}`}
              </Button>
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={() => startCheckout('yearly')}
                disabled={loading !== null || !CHECKOUT_ENABLED.pro}
                title={!CHECKOUT_ENABLED.pro ? COMING_SOON_LABEL : undefined}
              >
                {loading === 'yearly' ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : null}
                {CHECKOUT_ENABLED.pro ? 'Jaarlijks · €290' : `Jaarlijks · ${COMING_SOON_LABEL}`}
              </Button>
            </div>
            {!CHECKOUT_ENABLED.pro && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                Indicatieve prijzen — Stripe wordt binnenkort geactiveerd.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}