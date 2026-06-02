import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface BenchData {
  current_views: number; previous_views: number;
  current_clicks: number; previous_clicks: number;
  current_conversions: number; previous_conversions: number;
}

function delta(cur: number, prev: number): { pct: number; up: boolean | null } {
  if (prev === 0) return { pct: cur > 0 ? 100 : 0, up: cur > 0 ? true : null };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { pct, up: pct === 0 ? null : pct > 0 };
}

export function HistoricalBenchmark({ restaurantId, days = 90 }: { restaurantId: string; days?: number }) {
  const [data, setData] = useState<BenchData | null>(null);

  useEffect(() => {
    (async () => {
      const { data: rows, error } = await (supabase as any).rpc('get_owner_historical_benchmark', {
        p_restaurant_id: restaurantId, p_days: days,
      });
      if (!error && rows?.[0]) {
        const r = rows[0];
        setData({
          current_views: Number(r.current_views) || 0,
          previous_views: Number(r.previous_views) || 0,
          current_clicks: Number(r.current_clicks) || 0,
          previous_clicks: Number(r.previous_clicks) || 0,
          current_conversions: Number(r.current_conversions) || 0,
          previous_conversions: Number(r.previous_conversions) || 0,
        });
      } else {
        setData({ current_views: 0, previous_views: 0, current_clicks: 0, previous_clicks: 0, current_conversions: 0, previous_conversions: 0 });
      }
    })();
  }, [restaurantId, days]);

  if (!data) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Benchmark laden…</CardContent></Card>;
  }

  const rows = [
    { label: 'Weergaven', cur: data.current_views, prev: data.previous_views },
    { label: 'Clicks', cur: data.current_clicks, prev: data.previous_clicks },
    { label: 'Conversies', cur: data.current_conversions, prev: data.previous_conversions },
  ];

  const hasHistory = data.previous_views + data.previous_clicks + data.previous_conversions > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-5 w-5 text-primary" />
          Vergelijking met vorig jaar · {days} dagen
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!hasHistory ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nog geen data van vorig jaar beschikbaar voor deze periode.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {rows.map(r => {
              const d = delta(r.cur, r.prev);
              const color = d.up === null ? 'text-muted-foreground' : d.up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
              const Icon = d.up === null ? Minus : d.up ? TrendingUp : TrendingDown;
              return (
                <div key={r.label} className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{r.label}</p>
                  <p className="text-2xl font-bold tabular-nums">{r.cur.toLocaleString('nl-NL')}</p>
                  <div className={`flex items-center gap-1 text-xs font-medium ${color}`}>
                    <Icon className="h-3.5 w-3.5" />
                    <span>{d.up === null ? '0%' : `${d.up ? '+' : ''}${d.pct}%`}</span>
                    <span className="text-muted-foreground font-normal">vs {r.prev.toLocaleString('nl-NL')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}