import { Star, Image as ImageIcon } from 'lucide-react';
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
}

export function ReviewList({ reviews, loading, isOwner = false, onRefetch }: ReviewListProps) {
  const { t, i18n } = useTranslation();
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
    return (
      <p className="text-center text-muted-foreground py-8">
        {t('reviews.empty', 'Nog geen reviews. Wees de eerste!')}
      </p>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {reviews.map((review, index) => (
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
            <div className="flex items-center gap-0.5 shrink-0">
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
            </div>
          </div>

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
