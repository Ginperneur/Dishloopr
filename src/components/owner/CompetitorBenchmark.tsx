import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, Star, Eye, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface CompetitorBenchmarkProps {
  restaurantId: string;
  cityId: string;
  cuisines: string[];
  rating: number;
  reviewCount: number;
}

interface BenchmarkData {
  avgRating: number;
  avgReviews: number;
  totalCompetitors: number;
  ratingPercentile: number;
  reviewPercentile: number;
}

export function CompetitorBenchmark({ restaurantId, cityId, cuisines, rating, reviewCount }: CompetitorBenchmarkProps) {
  const [benchmark, setBenchmark] = useState<BenchmarkData | null>(null);

  useEffect(() => {
    const fetchBenchmark = async () => {
      // Get competitors in same city with overlapping cuisines
      const { data } = await supabase
        .from('restaurants')
        .select('id, rating, review_count')
        .eq('city_id', cityId)
        .eq('is_active', true)
        .neq('id', restaurantId);

      if (!data || data.length === 0) return;

      // Filter by overlapping cuisines
      const competitors = data;
      const ratings = competitors.map(c => Number(c.rating)).filter(r => r > 0);
      const reviews = competitors.map(c => c.review_count).filter(r => r > 0);

      const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      const avgReviews = reviews.length > 0 ? reviews.reduce((a, b) => a + b, 0) / reviews.length : 0;

      // Calculate percentile
      const ratingPercentile = Math.round((ratings.filter(r => r < rating).length / ratings.length) * 100);
      const reviewPercentile = Math.round((reviews.filter(r => r < reviewCount).length / reviews.length) * 100);

      setBenchmark({
        avgRating,
        avgReviews,
        totalCompetitors: competitors.length,
        ratingPercentile,
        reviewPercentile,
      });
    };

    if (restaurantId && cityId) fetchBenchmark();
  }, [restaurantId, cityId, rating, reviewCount]);

  if (!benchmark) return null;

  const ratingDiff = rating - benchmark.avgRating;
  const reviewDiff = reviewCount - benchmark.avgReviews;

  const TrendIcon = ({ value }: { value: number }) => {
    if (value > 0.1) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (value < -0.1) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Benchmark vs. {benchmark.totalCompetitors} concurrenten
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rating comparison */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-rating" />
            <div>
              <p className="text-sm font-medium">Beoordeling</p>
              <p className="text-xs text-muted-foreground">
                Top {100 - benchmark.ratingPercentile}% in jouw stad
              </p>
            </div>
          </div>
          <div className="text-right flex items-center gap-2">
            <div>
              <p className="text-sm font-bold">{rating.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">gem. {benchmark.avgRating.toFixed(1)}</p>
            </div>
            <TrendIcon value={ratingDiff} />
          </div>
        </div>

        {/* Review count comparison */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-medium">Aantal reviews</p>
              <p className="text-xs text-muted-foreground">
                Top {100 - benchmark.reviewPercentile}% in jouw stad
              </p>
            </div>
          </div>
          <div className="text-right flex items-center gap-2">
            <div>
              <p className="text-sm font-bold">{reviewCount}</p>
              <p className="text-xs text-muted-foreground">gem. {Math.round(benchmark.avgReviews)}</p>
            </div>
            <TrendIcon value={reviewDiff} />
          </div>
        </div>

        {/* Insight */}
        <p className="text-xs text-muted-foreground bg-primary/5 p-3 rounded-lg">
          💡 {ratingDiff > 0 
            ? `Je scoort ${ratingDiff.toFixed(1)} punten hoger dan gemiddeld. Gebruik dit in je marketing!`
            : ratingDiff < -0.3 
              ? `Focus op het verbeteren van je reviews om hoger te scoren dan concurrenten.`
              : `Je scoort rond het gemiddelde. Meer reviews kunnen je helpen om eruit te springen.`
          }
        </p>
      </CardContent>
    </Card>
  );
}
