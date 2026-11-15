import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Crown, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Offer { page_slug: string; dish_name: string; position: number; total: number; searches_per_month: number; places_left: number }

/** Every dish page the restaurant is on, with its position, demand and places left for Uitgelicht. */
export function UitgelichtOffers({ restaurantSlug }: { restaurantSlug: string }) {
  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['uitgelicht-offers', restaurantSlug],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('uitgelicht_page_offers', { p_slug: restaurantSlug });
      if (error) throw error;
      return ((data ?? []) as Offer[]).sort((a, b) => b.searches_per_month - a.searches_per_month || a.position - b.position);
    },
  });
  if (isLoading) return <div className="h-24 animate-pulse rounded-lg bg-muted" />;
  if (!offers.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Crown className="h-5 w-5 text-primary" />Jouw gerechtpagina's</CardTitle>
        <CardDescription>Hier sta je nu. Met Uitgelicht sta je bovenaan; per pagina zijn er maar 5 plekken.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {offers.map(o => (
          <div key={o.page_slug} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="font-medium">{o.dish_name}</p>
              <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                <span>Nu #{o.position} van {o.total}</span>
                {o.searches_per_month > 0 && <span className="flex items-center gap-1"><Search className="h-3 w-3" />{Math.round(o.searches_per_month).toLocaleString('nl-NL')} zoekopdrachten per maand</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={o.places_left === 0 ? 'destructive' : o.places_left <= 2 ? 'default' : 'secondary'}>
                {o.places_left === 0 ? 'Vol, bied mee' : `Nog ${o.places_left} ${o.places_left === 1 ? 'plek' : 'plekken'}`}
              </Badge>
              <Button size="sm" variant={o.places_left === 0 ? 'outline' : 'default'} asChild>
                <Link to={`/voor-restaurants/pakketten?slug=${encodeURIComponent(restaurantSlug)}&page=${encodeURIComponent(o.page_slug)}`}>
                  {o.places_left === 0 ? 'Bieden' : 'Kies'}
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
