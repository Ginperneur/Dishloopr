import { useEffect, useState } from 'react';
import { TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Row {
  target_restaurant_id: string;
  clicks: number;
  name: string;
  rating: number;
}

export function LostToCompetitor({ restaurantId }: { restaurantId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Searches in the city for dishes on this menu that ended in a click on another restaurant.
      const { data } = await (supabase.rpc as any)('owner_lost_to_competitor', { p_restaurant_id: restaurantId, p_days: 60 });
      setRows(((data ?? []) as { target_restaurant_id: string; name: string; rating: number | null; clicks: number }[])
        .map(r => ({ target_restaurant_id: r.target_restaurant_id, name: r.name, rating: Number(r.rating ?? 0), clicks: Number(r.clicks) })));
      setLoading(false);
    })();
  }, [restaurantId]);

  if (loading) return <Card><CardContent className="p-4 text-sm text-muted-foreground">Laden…</CardContent></Card>;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingDown className="h-4 w-4" />
          Restaurants waar gasten op klikten na een zoekopdracht naar een gerecht dat jij ook serveert (laatste 60 dagen).
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">Nog geen gasten verloren aan andere restaurants.</p>
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
                  <Badge variant="secondary" className="text-xs">{r.clicks} gasten</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}