import { ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OwnerTabHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * Sticky sub-header for each owner-dashboard tab.
 * Sits below the global header + restaurant switcher bar.
 */
export function OwnerTabHeader({ icon: Icon, title, description, actions, className }: OwnerTabHeaderProps) {
  return (
    <div
      className={cn(
        'sticky top-[7.5rem] md:top-[8rem] z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 mb-4',
        'bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base md:text-lg font-semibold leading-tight truncate">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground truncate hidden sm:block">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}