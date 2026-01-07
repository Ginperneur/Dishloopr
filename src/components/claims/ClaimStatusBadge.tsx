import { 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  Lock,
  HelpCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RestaurantClaimStatus } from '@/types/claims';
import { cn } from '@/lib/utils';

interface ClaimStatusBadgeProps {
  status: RestaurantClaimStatus;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<RestaurantClaimStatus, {
  label: string;
  description: string;
  icon: React.ElementType;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
}> = {
  unclaimed: {
    label: 'Niet geclaimd',
    description: 'Dit restaurant is nog niet geclaimd door een eigenaar.',
    icon: HelpCircle,
    variant: 'outline',
    className: 'text-muted-foreground',
  },
  claimed_unverified: {
    label: 'Geclaimd',
    description: 'Dit restaurant is geclaimd maar nog niet geverifieerd. Sommige functies zijn beperkt.',
    icon: Clock,
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  verified_owner: {
    label: 'Geverifieerd',
    description: 'Dit restaurant wordt beheerd door een geverifieerde eigenaar.',
    icon: ShieldCheck,
    variant: 'default',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  disputed: {
    label: 'In dispuut',
    description: 'Er is een eigenaarschapsdispuut gaande. Sommige acties zijn tijdelijk geblokkeerd.',
    icon: AlertTriangle,
    variant: 'destructive',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  },
  locked: {
    label: 'Vergrendeld',
    description: 'Dit restaurant is vergrendeld door een beheerder voor review.',
    icon: Lock,
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
};

const sizeClasses = {
  sm: 'text-xs py-0.5 px-1.5',
  md: 'text-sm py-1 px-2',
  lg: 'text-base py-1.5 px-3',
};

export function ClaimStatusBadge({ 
  status, 
  showTooltip = true, 
  size = 'md',
  className 
}: ClaimStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const badge = (
    <Badge 
      variant={config.variant}
      className={cn(config.className, sizeClasses[size], className)}
    >
      <Icon className={cn(
        'mr-1',
        size === 'sm' && 'h-3 w-3',
        size === 'md' && 'h-3.5 w-3.5',
        size === 'lg' && 'h-4 w-4',
      )} />
      {config.label}
    </Badge>
  );

  if (!showTooltip) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
