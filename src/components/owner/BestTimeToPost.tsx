import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';

const DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function BestTimeToPost({ restaurantId }: { restaurantId: string }) {
  const [grid, setGrid] = useState<number[][]>(() => Array.from({ length: 7 }, () => Array(24).fill(0)));
  const [best, setBest] = useState<{ day: number; hour: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Searches in the city for this restaurant's dishes, per weekday (1 = Monday) and hour, Amsterdam time.
      const { data } = await (supabase.rpc as any)('owner_search_hours', { p_restaurant_id: restaurantId, p_days: 60 });
      const g = Array.from({ length: 7 }, () => Array(24).fill(0));
      ((data ?? []) as { weekday: number; hour: number; searches: number }[]).forEach((r) => {
        g[r.weekday - 1][r.hour] += Number(r.searches);
      });
      let max = 0, bestDay = 0, bestHour = 12;
      g.forEach((row, di) => row.forEach((v, hi) => { if (v > max) { max = v; bestDay = di; bestHour = hi; } }));
      setGrid(g);
      setBest(max > 0 ? { day: bestDay, hour: bestHour } : null);
      setLoading(false);
    })();
  }, [restaurantId]);

  const max = Math.max(1, ...grid.flat());

  if (loading) return <Card><CardContent className="p-4 text-sm text-muted-foreground">Laden…</CardContent></Card>;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Wanneer mensen in jouw stad zoeken naar gerechten die jij serveert (laatste 60 dagen).
        </div>
        {best ? (
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm font-medium">
              Beste tijd: <span className="text-primary">{DAYS[best.day]} {best.hour.toString().padStart(2, '0')}:00</span>
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nog te weinig data.</p>
        )}

        <div className="overflow-x-auto">
          <table className="text-[10px]">
            <thead>
              <tr>
                <th className="w-6"></th>
                {HOURS.map((h) => <th key={h} className="w-4 text-center text-muted-foreground">{h % 3 === 0 ? h : ''}</th>)}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d, di) => (
                <tr key={d}>
                  <td className="text-muted-foreground pr-1">{d}</td>
                  {HOURS.map((h) => {
                    const v = grid[di][h];
                    const intensity = v / max;
                    return (
                      <td key={h} className="p-0.5">
                        <div
                          className="w-3 h-3 rounded-sm"
                          style={{ backgroundColor: `hsl(var(--primary) / ${0.08 + intensity * 0.85})` }}
                          title={`${d} ${h}:00 — ${v}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}