import { LucideIcon, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface OwnerEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Compact variant for inline use inside cards. */
  compact?: boolean;
  className?: string;
}

/**
 * Reusable empty-state for the owner dashboard.
 * Centralizes tone, spacing and a11y so every tab looks consistent.
 */
export function OwnerEmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  compact = false,
  className,
}: OwnerEmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-6 px-4 gap-2' : 'py-12 px-6 gap-3',
        className,
      )}
    >
      <div
        className={cn(
          'rounded-full bg-muted/60 flex items-center justify-center',
          compact ? 'h-10 w-10' : 'h-14 w-14',
        )}
        aria-hidden="true"
      >
        <Icon className={cn('text-muted-foreground', compact ? 'h-5 w-5' : 'h-6 w-6')} />
      </div>
      <p className={cn('font-semibold text-foreground', compact ? 'text-sm' : 'text-base')}>
        {title}
      </p>
      {description && (
        <p
          className={cn(
            'text-muted-foreground max-w-sm',
            compact ? 'text-xs' : 'text-sm',
          )}
        >
          {description}
        </p>
      )}
      {action && (
        <Button
          size={compact ? 'sm' : 'default'}
          variant="default"
          onClick={action.onClick}
          className="mt-1"
        >
          {action.icon && <action.icon className="h-4 w-4 mr-2" />}
          {action.label}
        </Button>
      )}
    </div>
  );
}