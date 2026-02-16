import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Star, MessageSquare, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { NeighborhoodCompetitor } from '@/hooks/useMarketInsights';

interface NeighborhoodAnalysisProps {
  competitors: NeighborhoodCompetitor[];
  myRating: number;
  myReviewCount: number;
  myName: string;
}

export function NeighborhoodAnalysis({ competitors, myRating, myReviewCount, myName }: NeighborhoodAnalysisProps) {
  if (competitors.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Geen vergelijkbare restaurants gevonden in je stad.</p>
        </CardContent>
      </Card>
    );
  }

  const avgRating = competitors.reduce((s, c) => s + c.rating, 0) / competitors.length;
  const avgReviews = Math.round(competitors.reduce((s, c) => s + c.review_count, 0) / competitors.length);
  const ratingDiff = myRating - avgRating;
  const reviewDiff = myReviewCount - avgReviews;

  const ratingRank = [...competitors, { rating: myRating } as any]
    .sort((a, b) => b.rating - a.rating)
    .findIndex(r => r.rating === myRating) + 1;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Jouw rating vs. gemiddeld</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-bold">{myRating.toFixed(1)}</span>
              <span className="text-muted-foreground">vs</span>
              <span className="text-lg text-muted-foreground">{avgRating.toFixed(1)}</span>
            </div>
            <div className={`flex items-center justify-center gap-1 mt-1 text-sm ${ratingDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {ratingDiff >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {ratingDiff >= 0 ? '+' : ''}{ratingDiff.toFixed(1)} verschil
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Reviews vs. gemiddeld</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-bold">{myReviewCount}</span>
              <span className="text-muted-foreground">vs</span>
              <span className="text-lg text-muted-foreground">{avgReviews}</span>
            </div>
            <div className={`flex items-center justify-center gap-1 mt-1 text-sm ${reviewDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {reviewDiff >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {reviewDiff >= 0 ? '+' : ''}{reviewDiff} reviews
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Ranking in je stad</p>
            <span className="text-2xl font-bold">#{ratingRank}</span>
            <p className="text-sm text-muted-foreground mt-1">van {competitors.length + 1} restaurants</p>
          </CardContent>
        </Card>
      </div>

      {/* Competitor List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Vergelijkbare restaurants
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Your restaurant highlighted */}
          <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary/30 bg-primary/5">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{myName} (jij)</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-medium">{myRating.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="text-sm">{myReviewCount}</span>
              </div>
            </div>
          </div>

          {competitors.slice(0, 8).map((comp, i) => (
            <motion.div
              key={comp.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                to={`/restaurant/${comp.slug}`}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{comp.name}</p>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {(comp.cuisines || []).slice(0, 3).map(c => (
                      <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                    <span className="text-sm font-medium">{comp.rating.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="text-sm">{comp.review_count}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
