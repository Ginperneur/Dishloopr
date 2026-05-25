import { ReactNode } from 'react';
import { Lock, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProBadge } from './ProBadge';
import { useOwnerTier } from '@/hooks/useOwnerTier';

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
    <div className="relative overflow-hidden rounded-xl">
      <div className="pointer-events-none blur-sm opacity-60">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] gap-3 p-6 text-center">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Crown className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-sm">Owner Pro functie</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Upgrade je restaurant naar Pro om diepere inzichten en tools te ontgrendelen.
          </p>
        </div>
        <Button size="sm" variant="default">
          <Lock className="h-3 w-3 mr-1" /> Upgrade naar Pro
        </Button>
      </div>
    </div>
  );
}