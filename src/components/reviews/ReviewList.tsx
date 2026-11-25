import { useMemo, useState } from 'react';
import { Star, Image as ImageIcon } from 'lucide-react';
import { formatDishName } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ReviewerBadge, VerifiedBadge } from './ReviewerBadge';
import { HelpfulButton } from './HelpfulButton';
import { OwnerResponse } from './OwnerResponse';
import type { ReviewWithProfile } from '@/hooks/useReviews';

interface ReviewListProps {
  reviews: ReviewWithProfile[];
  loading: boolean;
  isOwner?: boolean;
  onRefetch?: () => void;
  hideEmpty?: boolean;
}

type Filter = 'all' | 'restaurant' | string;

export function ReviewList({ reviews, loading, isOwner = false, onRefetch, hideEmpty = false }: ReviewListProps) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');

  // Filter chips: everything, reviews about the restaurant, and one per reviewed dish (most reviews first).
  const dishes = useMemo(() => {
    const byDish = new Map<string, { id: string; name: string; ratings: number[] }>();
    for (const r of reviews) for (const d of r.dishRatings ?? []) {
      const e = byDish.get(d.dishId) ?? { id: d.dishId, name: d.dishName, ratings: [] };
      e.ratings.push(d.rating);
      byDish.set(d.dishId, e);
    }
    return [...byDish.values()].sort((a, b) => b.ratings.length - a.ratings.length || a.name.localeCompare(b.name, 'nl'));
  }, [reviews]);
  const aboutRestaurant = reviews.filter(r => r.about_restaurant !== false);
  const shown = filter === 'all' ? reviews
    : filter === 'restaurant' ? aboutRestaurant
    : reviews.filter(r => r.dishRatings?.some(d => d.dishId === filter));
  const selectedDish = dishes.find(d => d.id === filter);
  const chips = [
    { id: 'all', label: t('reviews.filterAll', 'Alle reviews'), count: reviews.length },
    { id: 'restaurant', label: t('reviews.filterRestaurant', 'Over het restaurant'), count: aboutRestaurant.length },
    ...dishes.map(d => ({ id: d.id, label: formatDishName(d.name), count: d.ratings.length })),
  ].filter(c => c.id === 'all' || c.count > 0);
  const dateLocaleMap: Record<string, string> = {
    nl: 'nl-NL', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', es: 'es-ES',
  };
  const dateLocale = dateLocaleMap[i18n.language?.slice(0, 2) ?? 'nl'] || 'nl-NL';
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="p-4 rounded-xl bg-muted/50 animate-pulse">
            <div className="h-4 w-32 bg-muted rounded mb-2" />
            <div className="h-3 w-24 bg-muted rounded mb-3" />
            <div className="h-4 w-48 bg-muted rounded mb-2" />
            <div className="h-3 w-full bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    if (hideEmpty) return null;
    return (
      <p className="text-center text-muted-foreground py-8">
        {t('reviews.empty', 'Nog geen reviews. Wees de eerste!')}
      </p>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {dishes.length > 0 && (
        <div className="space-y-2">
          <p id="review-filter-label" className="text-sm font-medium">{t('reviews.filterLabel', 'Filter op gerecht')}</p>
          <div role="group" aria-labelledby="review-filter-label" className="flex flex-wrap gap-2">
            {chips.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.id)}
                aria-pressed={filter === c.id}
                className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${filter === c.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                {c.label} <span className="opacity-75">({c.count})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedDish && (() => {
        const n = selectedDish.ratings.length;
        const avg = selectedDish.ratings.reduce((a, b) => a + b, 0) / n;
        return (
          <div className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center">
            <div className="flex-1 space-y-1">
              <p className="text-lg font-semibold">{formatDishName(selectedDish.name)}</p>
              <p className="text-sm">
                <Star className="mr-1 inline h-4 w-4 fill-rating text-rating" aria-hidden="true" />
                <strong>{avg.toLocaleString(dateLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
                <span className="text-muted-foreground"> {t('reviews.dishCount', 'uit {{n}} reviews van dit gerecht', { n })}</span>
              </p>
            </div>
            <div className="flex-1 space-y-1" aria-label={t('reviews.distribution', 'Verdeling van de sterren')}>
              {[5, 4, 3, 2, 1].map(stars => {
                const count = selectedDish.ratings.filter(r => r === stars).length;
                return (
                  <div key={stars} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-8">{stars} ★</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-rating" style={{ width: `${(count / n) * 100}%` }} /></div>
                    <span className="w-5 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {shown.length === 0 && (
        <p className="py-6 text-center text-muted-foreground">{t('reviews.noneForFilter', 'Nog geen reviews voor deze keuze.')}</p>
      )}

      {shown.map((review, index) => (
        <motion.div
          key={review.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="p-3 md:p-4 rounded-xl bg-muted/50"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-2 md:mb-3">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <Avatar className="h-8 w-8 md:h-10 md:w-10 shrink-0">
                <AvatarImage src={review.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-xs md:text-sm">
                  {review.profile?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm md:text-base truncate">
                    {review.profile?.name || t('reviews.anonymous', 'Anoniem')}
                  </p>
                  {review.profile?.reviewer_level && (
                    <ReviewerBadge 
                      level={review.profile.reviewer_level as 'bronze' | 'silver' | 'gold' | 'platinum'} 
                      reviewCount={review.profile.total_reviews || 0}
                      size="sm"
                      showLabel={false}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs md:text-sm text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString(dateLocale, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                  {review.is_verified && <VerifiedBadge size="sm" />}
                </div>
              </div>
            </div>
            {review.about_restaurant !== false && <div className="flex items-center gap-0.5 shrink-0" aria-label={t('reviews.restaurantStars', '{{n}} van 5 voor het restaurant', { n: review.rating })}>
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-3.5 w-3.5 md:h-4 md:w-4 ${
                    i < review.rating
                      ? 'fill-rating text-rating'
                      : 'text-muted-foreground'
                  }`}
                />
              ))}
            </div>}
          </div>

          {/* Stars per dish */}
          {(review.dishRatings?.length ?? 0) > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {review.dishRatings!.map(d => (
                <span key={d.dishId} className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-2.5 py-1 text-sm">
                  {formatDishName(d.dishName)}
                  <span className="text-rating" aria-label={t('reviews.dishStars', '{{n}} van 5', { n: d.rating })}>{'★'.repeat(d.rating)}<span className="text-muted-foreground/40">{'★'.repeat(5 - d.rating)}</span></span>
                </span>
              ))}
            </div>
          )}

          {/* Part scores */}
          {review.about_restaurant !== false && (review.service_rating || review.atmosphere_rating || review.value_rating) ? (
            <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {([['Service', review.service_rating], ['Sfeer', review.atmosphere_rating], ['Prijs en kwaliteit', review.value_rating]] as const)
                .filter(([, v]) => v).map(([label, v]) => (
                  <span key={label}>{label} <span className="text-rating" aria-label={`${v} van 5`}>{'★'.repeat(v!)}</span></span>
                ))}
            </div>
          ) : null}

          {/* Content */}
          {review.title && (
            <h4 className="font-medium text-sm md:text-base mb-1 md:mb-2">{review.title}</h4>
          )}
          {review.body && (
            <p className="text-muted-foreground text-sm md:text-base">{review.body}</p>
          )}

          {/* Photos */}
          {review.photos && review.photos.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
              {review.photos.map((photo, photoIndex) => (
                <motion.div
                  key={photoIndex}
                  whileHover={{ scale: 1.02 }}
                  className="relative shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden cursor-pointer"
                >
                  <img
                    src={photo}
                    alt={t('reviews.photoAlt', 'Review foto {{n}}', { n: photoIndex + 1 })}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 right-1 bg-black/50 rounded px-1 py-0.5">
                    <ImageIcon className="h-3 w-3 text-white" />
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2">
            <HelpfulButton
              reviewId={review.id}
              initialCount={review.helpful_count || 0}
              hasVoted={review.user_has_voted}
            />
          </div>
          
          {/* Owner Response */}
          <OwnerResponse
            reviewId={review.id}
            existingResponse={review.owner_response}
            responseDate={review.owner_response_at}
            canRespond={isOwner && !review.owner_response}
            onResponseAdded={onRefetch}
          />
        </motion.div>
      ))}
    </div>
  );
}
