import { Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { ReviewWithProfile } from '@/hooks/useReviews';

interface ReviewListProps {
  reviews: ReviewWithProfile[];
  loading: boolean;
}

export function ReviewList({ reviews, loading }: ReviewListProps) {
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
        Nog geen reviews. Wees de eerste!
      </p>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {reviews.map((review) => (
        <div key={review.id} className="p-3 md:p-4 rounded-xl bg-muted/50">
          <div className="flex items-start justify-between gap-3 mb-2 md:mb-3">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <Avatar className="h-8 w-8 md:h-10 md:w-10 shrink-0">
                <AvatarImage src={review.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-xs md:text-sm">
                  {review.profile?.name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-sm md:text-base truncate">{review.profile?.name || 'Anoniem'}</p>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString('nl-NL', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
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
          {review.title && <h4 className="font-medium text-sm md:text-base mb-1 md:mb-2">{review.title}</h4>}
          {review.body && <p className="text-muted-foreground text-sm md:text-base">{review.body}</p>}
          
          {/* Owner Response */}
          {review.owner_response && (
            <div className="mt-3 md:mt-4 p-2 md:p-3 rounded-lg bg-background border-l-2 border-primary">
              <p className="text-xs md:text-sm font-medium mb-1">Reactie van eigenaar</p>
              <p className="text-xs md:text-sm text-muted-foreground">{review.owner_response}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
