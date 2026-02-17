import { Link } from 'react-router-dom';
import { Star, Search, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Review {
  id: string;
  rating: number;
  title: string | null;
  created_at: string;
  restaurants?: { name: string; slug: string } | null;
}

interface RecentReviewsProps {
  reviews: Review[];
}

export function RecentReviews({ reviews }: RecentReviewsProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-base sm:text-lg font-semibold">Recente reviews</h2>
        {reviews.length > 0 && (
          <Link to="/insights" className="text-xs sm:text-sm text-primary hover:underline flex items-center gap-1">
            Alles <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 sm:p-8 text-center">
          <Star className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="font-medium text-sm mb-1">Nog geen reviews</p>
          <p className="text-xs text-muted-foreground mb-3">
            Deel je ervaring en help andere foodies!
          </p>
          <Button asChild size="sm" variant="outline">
            <Link to="/search">
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Zoek een restaurant
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {reviews.map((review) => (
            <Link
              key={review.id}
              to={`/restaurant/${review.restaurants?.slug || ''}`}
              className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-0.5 shrink-0">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${
                      i < review.rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/20'
                    }`}
                  />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {review.restaurants?.name || 'Restaurant'}
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground shrink-0">
                {new Date(review.created_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
