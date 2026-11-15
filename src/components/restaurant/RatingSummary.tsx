import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatScore, getRatingDisplay, type RatingInput } from '@/lib/ratingDisplay';

interface Props extends RatingInput {
  size?: 'sm' | 'md';
  className?: string;
}

export function RatingSummary({ size = 'sm', className, ...input }: Props) {
  const { t, i18n } = useTranslation();
  const d = getRatingDisplay(input);
  if (d.mode === 'none') return null;
  const star = size === 'md' ? 'h-4 w-4 md:h-5 md:w-5' : 'h-3.5 w-3.5 sm:h-4 sm:w-4';

  return (
    <div className={cn('flex items-center gap-1 text-sm', className)}>
      <Star className={cn(star, 'fill-rating text-rating')} />
      <span className="font-semibold text-foreground">{formatScore(d.own, i18n.language)}</span>
      <span className="text-xs text-muted-foreground">{t('rating.onDishloopr', 'op Dishloopr')}</span>
    </div>
  );
}
