import { Shield, Award, Star, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

type ReviewerLevel = 'bronze' | 'silver' | 'gold' | 'platinum';

interface ReviewerBadgeProps {
  level: ReviewerLevel;
  reviewCount?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const levelConfig: Record<ReviewerLevel, {
  label: string;
  icon: typeof Award;
  className: string;
  bgClassName: string;
}> = {
  bronze: {
    label: 'Bronze Foodie',
    icon: Award,
    className: 'text-amber-700',
    bgClassName: 'bg-amber-100 dark:bg-amber-900/30',
  },
  silver: {
    label: 'Silver Foodie',
    icon: Star,
    className: 'text-slate-500',
    bgClassName: 'bg-slate-100 dark:bg-slate-800/50',
  },
  gold: {
    label: 'Gold Foodie',
    icon: Crown,
    className: 'text-yellow-600',
    bgClassName: 'bg-yellow-100 dark:bg-yellow-900/30',
  },
  platinum: {
    label: 'Platinum Foodie',
    icon: Shield,
    className: 'text-violet-600',
    bgClassName: 'bg-violet-100 dark:bg-violet-900/30',
  },
};

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

export function ReviewerBadge({ 
  level, 
  reviewCount, 
  showLabel = true,
  size = 'md' 
}: ReviewerBadgeProps) {
  const config = levelConfig[level] || levelConfig.bronze;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        config.bgClassName,
        config.className,
        sizeClasses[size]
      )}
    >
      <Icon className={iconSizes[size]} />
      {showLabel && <span>{config.label}</span>}
      {reviewCount !== undefined && reviewCount > 0 && (
        <span className="opacity-70">({reviewCount})</span>
      )}
    </div>
  );
}

export function VerifiedBadge({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
        sizeClasses[size]
      )}
    >
      <Shield className={iconSizes[size]} />
      <span>Geverifieerd bezoek</span>
    </div>
  );
}
