import { Crown, Lock, ArrowRight, BarChart3, Target, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProUpsellBannerProps {
  onSeeMore: () => void;
}

/**
 * Overview-tab banner that makes it explicit a non-Pro owner does NOT yet have
 * access to Inzichten & Markt, and clarifies that Pro is one combined
 * subscription (not two separate €29 fees).
 */
export function ProUpsellBanner({ onSeeMore }: ProUpsellBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-background p-5 md:p-6">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
          backgroundSize: '22px 22px',
        }}
      />
      <div className="relative flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 shrink-0">
          <Crown className="h-6 w-6" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-wider mb-1.5">
            <Sparkles className="h-3 w-3" />
            Je hebt nog geen Owner Pro
          </div>
          <h3 className="text-base md:text-lg font-bold leading-tight mb-1">
            Inzichten & Markt zijn vergrendeld
          </h3>
          <p className="text-sm text-muted-foreground">
            Eén abonnement van <span className="font-semibold text-foreground">€29/maand</span> ontgrendelt
            <span className="font-semibold text-foreground"> beide</span> tabbladen — geen aparte kosten per functie.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-background border">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              Inzichten
              <Lock className="h-3 w-3 text-muted-foreground" />
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-background border">
              <Target className="h-3.5 w-3.5 text-primary" />
              Markt
              <Lock className="h-3 w-3 text-muted-foreground" />
            </span>
            <span className="inline-flex items-center text-xs px-2 py-1 rounded-md bg-primary/10 text-primary font-semibold">
              = 1× €29/maand
            </span>
          </div>
        </div>

        <Button onClick={onSeeMore} size="lg" className="shrink-0 self-start md:self-center">
          <Crown className="h-4 w-4 mr-1.5" />
          Bekijk Pro
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}