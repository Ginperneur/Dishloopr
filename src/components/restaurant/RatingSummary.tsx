import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { formatCount, formatScore, getRatingDisplay, type RatingInput } from '@/lib/ratingDisplay';

interface Props extends RatingInput {
  size?: 'sm' | 'md';
  className?: string;
}

export function RatingSummary({ size = 'sm', className, ...input }: Props) {
  const { t, i18n } = useTranslation();
  const d = getRatingDisplay(input);
  if (d.mode === 'none') return null;
  const lang = i18n.language;
  const star = size === 'md' ? 'h-4 w-4 md:h-5 md:w-5' : 'h-3.5 w-3.5 sm:h-4 sm:w-4';

  if (d.mode === 'google-only') {
    return (
      <div className={cn('flex items-center gap-1 text-sm', className)}>
        <Star className={cn(star, 'fill-rating text-rating')} />
        <span className="font-semibold text-foreground">{formatScore(d.google, lang)}</span>
        <span className="text-xs text-muted-foreground">
          {d.googleCount > 0
            ? `(${t('rating.googleReviews', '{{n}} Google-reviews', { n: formatCount(d.googleCount, lang) })})`
            : t('rating.google', 'Google')}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1 text-sm', className)}>
      <Star className={cn(star, 'fill-rating text-rating')} />
      <span className="font-semibold text-foreground">{formatScore(d.own, lang)}</span>
      <span className="text-xs text-muted-foreground">{t('rating.onDishloopr', 'op Dishloopr')}</span>
      {d.google != null && (
        <span className="text-xs text-muted-foreground">
          · <span className="font-medium text-foreground">{formatScore(d.google, lang)}</span> {t('rating.onGoogle', 'op Google')}
        </span>
      )}
    </div>
  );
}
