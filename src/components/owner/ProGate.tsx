import { ReactNode } from 'react';
import { Lock, Crown, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProBadge } from './ProBadge';
import { useOwnerTier } from '@/hooks/useOwnerTier';
import { useOwnerProCheckout } from '@/hooks/useOwnerProCheckout';
import { CHECKOUT_ENABLED, COMING_SOON_LABEL } from '@/lib/checkoutFlags';

interface ProGateProps {
  restaurantId: string | undefined;
  /** When true, blur + lock content for non-pro. When false (default), show content + Pro badge. */
  enforced?: boolean;
  /** Show a Pro pill in the corner even when not enforced. */
  showBadge?: boolean;
  children: ReactNode;
}

export function ProGate({ restaurantId, enforced = false, showBadge = true, children }: ProGateProps) {
  const { data: tier } = useOwnerTier(restaurantId);
  const { startCheckout, loading } = useOwnerProCheckout();
  const isPro = tier === 'pro';

  if (!enforced || isPro) {
    return (
      <div className="relative">
        {showBadge && !isPro && (
          <div className="absolute right-2 top-2 z-10">
            <ProBadge />
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none opacity-50">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
        <div className="text-center p-6 max-w-sm">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-2">Owner Pro functie</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Upgrade naar Pro (€29/maand of €290/jaar) om deze tools te ontgrendelen.
          </p>
          <Button
            size="sm"
            onClick={() => startCheckout('monthly')}
            disabled={loading !== null || !CHECKOUT_ENABLED.pro}
            title={!CHECKOUT_ENABLED.pro ? COMING_SOON_LABEL : undefined}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Crown className="h-4 w-4 mr-2" />
            )}
            {CHECKOUT_ENABLED.pro ? 'Upgrade naar Pro' : COMING_SOON_LABEL}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}