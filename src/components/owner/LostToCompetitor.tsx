import { useEffect, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Row {
  target_restaurant_id: string;
  count: number;
  clicks: number;
  name: string;
  rating: number;
}

export function LostToCompetitor({ restaurantId }: { restaurantId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('demand_routing_events')
        .select('target_restaurant_id, was_clicked, target:restaurants!demand_routing_events_target_restaurant_id_fkey(name, rating)')
        .eq('source_restaurant_id', restaurantId)
        .gte('created_at', since)
        .limit(1000);

      const agg = new Map<string, Row>();
      (data || []).forEach((r: any) => {
        const id = r.target_restaurant_id;
        const existing = agg.get(id) || {
          target_restaurant_id: id,
          count: 0,
          clicks: 0,
          name: r.target?.name || 'Onbekend',
          rating: r.target?.rating || 0,
        };
        existing.count++;
        if (r.was_clicked) existing.clicks++;
        agg.set(id, existing);
      });
      setRows([...agg.values()].sort((a, b) => b.clicks - a.clicks).slice(0, 10));
      setLoading(false);
    })();
  }, [restaurantId]);

  if (loading) return <Card><CardContent className="p-4 text-sm text-muted-foreground">Laden…</CardContent></Card>;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingDown className="h-4 w-4" />
          Restaurants waar gasten naartoe gaan als jij gerechten niet aanbiedt.
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">Nog geen routing-events.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r, i) => (
              <div key={r.target_restaurant_id} className="flex items-center justify-between p-2 rounded-lg border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">⭐ {r.rating?.toFixed(1) || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">{r.clicks} klikken</Badge>
                  <Badge variant="outline" className="text-xs">{r.count} weergaven</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}