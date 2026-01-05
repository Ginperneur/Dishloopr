import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SponsoredBadgeProps {
  variant?: 'default' | 'subtle';
  className?: string;
}

export function SponsoredBadge({ variant = 'default', className = '' }: SponsoredBadgeProps) {
  if (variant === 'subtle') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-muted-foreground ${className}`}>
        <Sparkles className="h-3 w-3" />
        Uitgelicht
      </span>
    );
  }

  return (
    <Badge 
      variant="secondary" 
      className={`bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 ${className}`}
    >
      <Sparkles className="h-3 w-3 mr-1" />
      Uitgelicht
    </Badge>
  );
}
