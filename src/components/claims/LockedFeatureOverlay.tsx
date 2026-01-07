import { Lock, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LockedFeatureOverlayProps {
  featureName: string;
  isLocked?: boolean;
  description?: string;
  onRequestVerification?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function LockedFeatureOverlay({
  featureName,
  isLocked = true,
  description,
  onRequestVerification,
  children,
  className,
}: LockedFeatureOverlayProps) {
  if (!isLocked && children) {
    return <>{children}</>;
  }

  // If no children, render as a standalone locked message
  if (!children) {
    return (
      <div className={cn('flex items-center justify-center p-12 bg-muted/30 rounded-lg border border-dashed', className)}>
        <div className="text-center max-w-sm">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          
          <h3 className="font-semibold mb-2">{featureName}</h3>
          
          <p className="text-sm text-muted-foreground mb-4">
            {description || 'Beschikbaar na verificatie. Verificatie beschermt restaurants en gasten tegen misbruik.'}
          </p>

          {onRequestVerification && (
            <Button onClick={onRequestVerification} size="sm">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Verifiëren
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {/* Blurred content */}
      <div className="blur-sm pointer-events-none select-none opacity-50">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
        <div className="text-center p-6 max-w-sm">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Lock className="h-6 w-6 text-muted-foreground" />
          </div>
          
          <h3 className="font-semibold mb-2">{featureName}</h3>
          
          <p className="text-sm text-muted-foreground mb-4">
            {description || 'Beschikbaar na verificatie. Verificatie beschermt restaurants en gasten tegen misbruik.'}
          </p>

          {onRequestVerification && (
            <Button onClick={onRequestVerification} size="sm">
              <ShieldCheck className="h-4 w-4 mr-2" />
              Verifiëren
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface LockedFeatureMessageProps {
  featureName: string;
  compact?: boolean;
}

export function LockedFeatureMessage({ featureName, compact = false }: LockedFeatureMessageProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        <span>Beschikbaar na verificatie</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <Lock className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-sm">{featureName}</p>
        <p className="text-sm text-muted-foreground">
          Beschikbaar na verificatie. Verificatie beschermt restaurants en gasten tegen misbruik.
        </p>
      </div>
    </div>
  );
}
