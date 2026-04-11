import { useState, useEffect } from 'react';
import { TrendingUp, Search, Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import {
  scoreRestaurant,
  sortResults,
  bayesianRating,
  type ScoringContext,
  type DishMatchInfo,
} from '@/lib/ranking';

interface RankingEntry {
  dishName: string;
  position: number;
  totalResults: number;
  matchScore: number;
  isSignature: boolean;
}

interface SearchRankingProps {
  restaurantId: string;
  restaurantName: string;
}

export function SearchRanking({ restaurantId, restaurantName }: SearchRankingProps) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (restaurantId) fetchRankings();
  }, [restaurantId]);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      // Get all dishes linked to this restaurant
      const { data: links } = await supabase
        .from('restaurant_dishes')
        .select('dish_id, is_signature, confidence_score')
        .eq('restaurant_id', restaurantId)
        .neq('status', 'rejected');

      if (!links || links.length === 0) {
        setRankings([]);
        setLoading(false);
        return;
      }

      const dishIds = links.map(l => l.dish_id);
      const { data: dishes } = await supabase
        .from('dishes')
        .select('id, name')
        .in('id', dishIds);

      if (!dishes) {
        setRankings([]);
        setLoading(false);
        return;
      }

      // For each dish, calculate this restaurant's position
      const results: RankingEntry[] = [];
      const now = new Date();

      for (const dish of dishes.slice(0, 15)) { // Limit to top 15 dishes
        // Get all restaurants with this dish
        const { data: allLinks } = await supabase
          .from('restaurant_dishes')
          .select('restaurant_id, is_signature, confidence_score')
          .eq('dish_id', dish.id)
          .neq('status', 'rejected');

        if (!allLinks || allLinks.length === 0) continue;

        const restaurantIds = [...new Set(allLinks.map(l => l.restaurant_id))];
        
        // Fetch restaurant data
        const { data: restaurants } = await supabase
          .from('restaurants')
          .select('id, name, rating, review_count, cuisines, is_featured, is_top_listing, chain_id, created_at')
          .eq('is_active', true)
          .in('id', restaurantIds);

        if (!restaurants) continue;

        const ctx: ScoringContext = { queryLower: dish.name.toLowerCase(), now };

        // Score all restaurants
        const scored = restaurants.map(r => {
          const rLinks = allLinks.filter(l => l.restaurant_id === r.id);
          const linkedDishes: DishMatchInfo[] = rLinks.map(l => ({
            name: dish.name,
            isSignature: l.is_signature || false,
            confidenceScore: Number(l.confidence_score) || 0.5,
          }));

          const result = scoreRestaurant({
            id: r.id,
            name: r.name,
            rating: Number(r.rating),
            review_count: r.review_count,
            cuisines: r.cuisines,
            is_featured: r.is_featured,
            is_top_listing: r.is_top_listing,
            chain_id: r.chain_id,
            created_at: r.created_at,
            linkedDishes,
            isSponsored: false,
          }, ctx);

          return {
            restaurantId: r.id,
            matchScore: result.matchScore,
            bayesianRating: result.bayesianRating,
          };
        });

        // Sort
        scored.sort((a, b) => {
          if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
          return b.bayesianRating - a.bayesianRating;
        });

        const position = scored.findIndex(s => s.restaurantId === restaurantId) + 1;
        const myLink = links.find(l => l.dish_id === dish.id);

        if (position > 0) {
          results.push({
            dishName: dish.name,
            position,
            totalResults: scored.length,
            matchScore: scored[position - 1]?.matchScore || 0,
            isSignature: myLink?.is_signature || false,
          });
        }
      }

      // Sort by position (best first)
      results.sort((a, b) => a.position - b.position);
      setRankings(results);
    } catch (e) {
      console.error('Ranking fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const getPositionColor = (pos: number) => {
    if (pos <= 3) return 'text-yellow-600 dark:text-yellow-400';
    if (pos <= 10) return 'text-green-600 dark:text-green-400';
    return 'text-muted-foreground';
  };

  const getPositionBadge = (pos: number, total: number) => {
    if (pos === 1) return 'default';
    if (pos <= 3) return 'secondary';
    return 'outline';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Ranking laden...
        </CardContent>
      </Card>
    );
  }

  if (rankings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Zoekpositie
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Geen gerechten gekoppeld. Voeg gerechten toe om je positie te zien.
          </p>
        </CardContent>
      </Card>
    );
  }

  const topRankings = rankings.slice(0, 5);
  const restRankings = rankings.slice(5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Zoekpositie per gerecht
        </CardTitle>
        <CardDescription>
          Waar je staat in de zoekresultaten wanneer gebruikers naar een gerecht zoeken
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {topRankings.map((r) => (
          <div key={r.dishName} className="flex items-center justify-between py-1.5 border-b last:border-0">
            <div className="flex items-center gap-2">
              <span className={`font-bold text-lg w-8 text-center ${getPositionColor(r.position)}`}>
                {r.position === 1 && <Trophy className="h-4 w-4 inline text-yellow-500" />}
                {r.position > 1 && `#${r.position}`}
              </span>
              <div>
                <span className="text-sm font-medium">{r.dishName}</span>
                {r.isSignature && (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] py-0">Signature</Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                van {r.totalResults}
              </span>
              <Badge variant={getPositionBadge(r.position, r.totalResults)}>
                {r.position <= 3 ? 'Top 3' : r.position <= 10 ? 'Top 10' : `#${r.position}`}
              </Badge>
            </div>
          </div>
        ))}

        {restRankings.length > 0 && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full text-xs">
                {open ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                {restRankings.length} meer gerechten
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2">
              {restRankings.map((r) => (
                <div key={r.dishName} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-lg w-8 text-center ${getPositionColor(r.position)}`}>
                      #{r.position}
                    </span>
                    <div>
                      <span className="text-sm font-medium">{r.dishName}</span>
                      {r.isSignature && (
                        <Badge variant="secondary" className="ml-1.5 text-[10px] py-0">Signature</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      van {r.totalResults}
                    </span>
                    <Badge variant={getPositionBadge(r.position, r.totalResults)}>
                      {r.position <= 3 ? 'Top 3' : r.position <= 10 ? 'Top 10' : `#${r.position}`}
                    </Badge>
                  </div>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        <p className="text-[10px] text-muted-foreground pt-2">
          Tip: Markeer gerechten als 'Signature' om hoger te scoren. Meer reviews = betere positie.
        </p>
      </CardContent>
    </Card>
  );
}
