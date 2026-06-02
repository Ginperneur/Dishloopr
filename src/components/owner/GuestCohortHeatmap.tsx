import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

interface Row { week_start: string; new_visitors: number; returning_visitors: number }

export function GuestCohortHeatmap({ restaurantId, weeks = 8 }: { restaurantId: string; weeks?: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any).rpc('get_guest_cohorts', {
        p_restaurant_id: restaurantId, p_weeks: weeks,
      });
      if (!error) {
        setRows((data ?? []).map((r: any) => ({
          week_start: r.week_start,
          new_visitors: Number(r.new_visitors) || 0,
          returning_visitors: Number(r.returning_visitors) || 0,
        })));
      } else {
        setRows([]);
      }
    })();
  }, [restaurantId, weeks]);

  if (rows === null) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Cohorten laden…</CardContent></Card>;
  }

  const max = Math.max(1, ...rows.map(r => r.new_visitors + r.returning_visitors));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5 text-primary" />
          Nieuw vs terugkerend · {weeks} weken
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nog te weinig sessiedata voor cohort-analyse.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(r => {
              const total = r.new_visitors + r.returning_visitors;
              const newPct = total > 0 ? (r.new_visitors / total) * 100 : 0;
              const widthPct = (total / max) * 100;
              return (
                <div key={r.week_start} className="flex items-center gap-3 text-xs">
                  <span className="w-20 shrink-0 tabular-nums text-muted-foreground">
                    {new Date(r.week_start).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })}
                  </span>
                  <div className="flex-1 h-6 rounded-md bg-muted overflow-hidden flex" style={{ width: `${Math.max(8, widthPct)}%` }}>
                    <div className="h-full bg-primary" style={{ width: `${newPct}%` }} />
                    <div className="h-full bg-primary/40" style={{ width: `${100 - newPct}%` }} />
                  </div>
                  <span className="w-24 shrink-0 text-right tabular-nums font-medium">
                    {r.new_visitors}<span className="text-muted-foreground"> / {r.returning_visitors}</span>
                  </span>
                </div>
              );
            })}
            <div className="flex items-center gap-4 pt-3 text-xs text-muted-foreground border-t mt-3">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary" /> nieuw</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-primary/40" /> terugkerend</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}