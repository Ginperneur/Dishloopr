import { Crown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function ProBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        'gap-1 bg-gradient-to-r from-primary/15 to-primary/5 text-primary border-primary/20 text-[10px] font-semibold px-1.5 py-0',
        className
      )}
    >
      <Crown className="h-2.5 w-2.5" />
      PRO
    </Badge>
  );
}