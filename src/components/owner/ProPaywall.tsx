import { Crown, Check, Loader2, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useOwnerProCheckout } from '@/hooks/useOwnerProCheckout';

interface ProPaywallProps {
  /** What feature the user is trying to access (e.g. "Inzichten & Analytics"). */
  featureName: string;
  /** Short intro line shown under the title. */
  description: string;
  /** Bullet list of concrete benefits the user unlocks. */
  benefits: string[];
}

/**
 * Full-section paywall shown when a non-Pro owner navigates to a Pro-only tab.
 * Replaces the gated content entirely (no blurred preview) so the value prop
 * and CTA are the only thing on screen.
 */
export function ProPaywall({ featureName, description, benefits }: ProPaywallProps) {
  const { startCheckout, loading } = useOwnerProCheckout();

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardContent className="p-6 md:p-10">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
            <Crown className="h-7 w-7" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wide mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            Owner Pro
          </div>

          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            {featureName} is een Pro-functie
          </h2>
          <p className="text-muted-foreground mb-6">{description}</p>

          <div className="text-left bg-card border rounded-xl p-5 md:p-6 mb-6">
            <p className="font-semibold mb-3">Wat krijg je met Owner Pro?</p>
            <ul className="space-y-2.5">
              {benefits.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
            <Button
              size="lg"
              onClick={() => startCheckout('monthly')}
              disabled={loading !== null}
              className="w-full sm:w-auto"
            >
              {loading === 'monthly' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Crown className="h-4 w-4 mr-2" />
              )}
              Upgrade naar Pro — €29/maand
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => startCheckout('yearly')}
              disabled={loading !== null}
              className="w-full sm:w-auto"
            >
              {loading === 'yearly' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Jaarlijks — €290 (2 maanden gratis)
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            Maandelijks opzegbaar. Direct toegang na betaling.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}