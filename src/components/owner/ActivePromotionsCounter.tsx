import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Sparkles, Crown, ChefHat, Timer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ActivePromo {
  id: string;
  type: 'featured' | 'top_listing' | 'featured_listing' | 'sponsored_dish';
  label: string;
  startsAt: Date;
  expiresAt: Date;
}

interface Props {
  restaurantId: string;
  restaurant: {
    is_featured?: boolean | null;
    featured_until?: string | null;
    is_top_listing?: boolean | null;
    top_until?: string | null;
  };
}

function fmtRemaining(end: Date): { label: string; pct: number } {
  const now = Date.now();
  const ms = end.getTime() - now;
  if (ms <= 0) return { label: 'Verlopen', pct: 100 };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  let label: string;
  if (days >= 1) label = `${days}d ${hours}u`;
  else if (hours >= 1) label = `${hours}u ${mins}m`;
  else label = `${mins}m`;
  return { label, pct: 0 };
}

const ICONS = {
  featured: Sparkles,
  top_listing: Crown,
  featured_listing: Crown,
  sponsored_dish: ChefHat,
};

export function ActivePromotionsCounter({ restaurantId, restaurant }: Props) {
  const [promos, setPromos] = useState<ActivePromo[]>([]);
  const [, setTick] = useState(0);

  // Live countdown ticker
  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;

    (async () => {
      const list: ActivePromo[] = [];
      const now = new Date();

      // Listing boosts on the restaurant itself
      if (restaurant.is_featured && restaurant.featured_until && new Date(restaurant.featured_until) > now) {
        list.push({
          id: `featured-listing-${restaurantId}`,
          type: 'featured_listing',
          label: 'Featured Listing',
          startsAt: new Date(),
          expiresAt: new Date(restaurant.featured_until),
        });
      }
      if (restaurant.is_top_listing && restaurant.top_until && new Date(restaurant.top_until) > now) {
        list.push({
          id: `top-listing-${restaurantId}`,
          type: 'top_listing',
          label: 'Top Listing',
          startsAt: new Date(),
          expiresAt: new Date(restaurant.top_until),
        });
      }

      // Featured marketplace subscriptions
      const { data: subs } = await supabase
        .from('featured_subscriptions')
        .select('id, starts_at, expires_at, status, featured_slots(cuisine, cities(name))')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'active')
        .gt('expires_at', now.toISOString());
      subs?.forEach((s: any) => {
        list.push({
          id: s.id,
          type: 'featured',
          label: `Premium plek — ${s.featured_slots?.cuisine ?? 'cuisine'}${
            s.featured_slots?.cities?.name ? ` · ${s.featured_slots.cities.name}` : ''
          }`,
          startsAt: new Date(s.starts_at),
          expiresAt: new Date(s.expires_at),
        });
      });

      // Sponsored dish purchases
      const { data: sps } = await supabase
        .from('sponsored_purchases')
        .select('id, starts_at, expires_at, is_active')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .gt('expires_at', now.toISOString());
      sps?.forEach((s: any) => {
        list.push({
          id: s.id,
          type: 'sponsored_dish',
          label: 'Gesponsord gerecht',
          startsAt: new Date(s.starts_at),
          expiresAt: new Date(s.expires_at),
        });
      });

      if (!cancelled) setPromos(list);
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId, restaurant.is_featured, restaurant.featured_until, restaurant.is_top_listing, restaurant.top_until]);

  if (promos.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6 text-center">
          <Timer className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Nog geen actieve promoties</p>
          <p className="text-xs text-muted-foreground">Activeer hieronder een boost om hier de looptijd te zien.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Actieve promoties · live looptijd</h4>
          <Badge variant="secondary" className="ml-auto text-[10px]">{promos.length} actief</Badge>
        </div>
        <div className="space-y-3">
          {promos.map((p) => {
            const Icon = ICONS[p.type];
            const total = p.expiresAt.getTime() - p.startsAt.getTime();
            const elapsed = Date.now() - p.startsAt.getTime();
            const pct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
            const { label } = fmtRemaining(p.expiresAt);
            return (
              <div key={p.id} className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium truncate">{p.label}</span>
                  <span className="ml-auto text-xs font-mono tabular-nums bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    nog {label}
                  </span>
                </div>
                <Progress value={pct} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground">
                  Loopt af op {p.expiresAt.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}