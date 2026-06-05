import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Crown, Sparkles, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';

interface PremiumPeriod {
  id: string;
  kind: 'featured' | 'sponsored';
  label: string;
  start: Date;
  end: Date;
}

interface ChartPoint {
  date: string;
  dayIndex: number; // -N..0..+N (0 = start of premium)
  premium: number | null;
  baseline: number | null;
}

interface Props {
  restaurantId?: string;
}

const MS_PER_DAY = 86_400_000;

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function PremiumReachChart({ restaurantId }: Props) {
  const [periods, setPeriods] = useState<PremiumPeriod[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [metric, setMetric] = useState<'view' | 'click'>('view');
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({ premium: 0, baseline: 0 });

  // Load premium periods
  useEffect(() => {
    if (!restaurantId) return;
    setLoading(true);

    (async () => {
      const [{ data: feats }, { data: sponsored }] = await Promise.all([
        supabase
          .from('featured_subscriptions')
          .select('id, starts_at, expires_at, status')
          .eq('restaurant_id', restaurantId)
          .not('starts_at', 'is', null)
          .order('starts_at', { ascending: false })
          .limit(10),
        supabase
          .from('sponsored_purchases')
          .select('id, starts_at, expires_at')
          .eq('restaurant_id', restaurantId)
          .not('starts_at', 'is', null)
          .order('starts_at', { ascending: false })
          .limit(10),
      ]);

      const all: PremiumPeriod[] = [];
      for (const f of feats ?? []) {
        if (!f.starts_at || !f.expires_at) continue;
        all.push({
          id: `feat-${f.id}`,
          kind: 'featured',
          label: `Featured listing`,
          start: new Date(f.starts_at),
          end: new Date(Math.min(new Date(f.expires_at).getTime(), Date.now())),
        });
      }
      for (const s of sponsored ?? []) {
        if (!s.starts_at || !s.expires_at) continue;
        all.push({
          id: `spon-${s.id}`,
          kind: 'sponsored',
          label: `Sponsored dish`,
          start: new Date(s.starts_at),
          end: new Date(Math.min(new Date(s.expires_at).getTime(), Date.now())),
        });
      }
      all.sort((a, b) => b.start.getTime() - a.start.getTime());
      setPeriods(all);
      setSelectedId(all[0]?.id ?? null);
      setLoading(false);
    })();
  }, [restaurantId]);

  // Load events for selected period
  useEffect(() => {
    if (!restaurantId || !selectedId) {
      setPoints([]);
      return;
    }
    const sel = periods.find((p) => p.id === selectedId);
    if (!sel) return;

    (async () => {
      const durationDays = Math.max(
        1,
        Math.ceil((sel.end.getTime() - sel.start.getTime()) / MS_PER_DAY),
      );
      const baselineStart = new Date(sel.start.getTime() - durationDays * MS_PER_DAY);

      const { data } = await supabase
        .from('analytics_events')
        .select('event_type, created_at')
        .eq('restaurant_id', restaurantId)
        .eq('event_type', metric)
        .gte('created_at', baselineStart.toISOString())
        .lt('created_at', sel.end.toISOString());

      // Build day buckets
      const buckets: Record<string, { premium: number; baseline: number }> = {};
      for (let i = -durationDays; i < durationDays; i++) {
        const d = new Date(sel.start.getTime() + i * MS_PER_DAY);
        buckets[ymd(d)] = { premium: 0, baseline: 0 };
      }

      let premiumTotal = 0;
      let baselineTotal = 0;

      for (const ev of data ?? []) {
        const t = new Date(ev.created_at).getTime();
        const day = ymd(new Date(t));
        if (!buckets[day]) continue;
        if (t >= sel.start.getTime()) {
          buckets[day].premium += 1;
          premiumTotal += 1;
        } else {
          buckets[day].baseline += 1;
          baselineTotal += 1;
        }
      }

      const next: ChartPoint[] = Object.keys(buckets)
        .sort()
        .map((date) => {
          const t = new Date(date).getTime();
          const dayIndex = Math.round((t - sel.start.getTime()) / MS_PER_DAY);
          return {
            date,
            dayIndex,
            premium: dayIndex >= 0 ? buckets[date].premium : null,
            baseline: dayIndex < 0 ? buckets[date].baseline : null,
          };
        });

      setPoints(next);
      setTotals({ premium: premiumTotal, baseline: baselineTotal });
    })();
  }, [restaurantId, selectedId, periods, metric]);

  const uplift = useMemo(() => {
    if (totals.baseline === 0) return totals.premium > 0 ? 100 : 0;
    return ((totals.premium - totals.baseline) / totals.baseline) * 100;
  }, [totals]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Premium impact laden…
        </CardContent>
      </Card>
    );
  }

  if (periods.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Extra bereik tijdens premium
          </CardTitle>
          <CardDescription>
            Zodra je een Featured listing of Sponsored dish activeert, zie je hier hoeveel extra weergaven en clicks
            je upgrade oplevert ten opzichte van de periode ervoor.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const sel = periods.find((p) => p.id === selectedId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Extra bereik tijdens premium
            </CardTitle>
            <CardDescription>
              Vergelijk je {metric === 'view' ? 'weergaven' : 'clicks'} tijdens de premium periode met de even lange
              periode ervoor.
            </CardDescription>
          </div>
          <Tabs value={metric} onValueChange={(v) => setMetric(v as 'view' | 'click')}>
            <TabsList>
              <TabsTrigger value="view">Weergaven</TabsTrigger>
              <TabsTrigger value="click">Clicks</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Period selector */}
        <div className="flex gap-2 flex-wrap">
          {periods.map((p) => {
            const Icon = p.kind === 'featured' ? Crown : Sparkles;
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border'
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{p.label}</span>
                <span className="opacity-70">
                  · {p.start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                </span>
              </button>
            );
          })}
        </div>

        {/* Totals */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Voor premium</p>
            <p className="text-xl font-bold">{totals.baseline.toLocaleString('nl-NL')}</p>
          </div>
          <div className="rounded-lg border bg-primary/10 p-3">
            <p className="text-xs text-muted-foreground">Tijdens premium</p>
            <p className="text-xl font-bold text-primary">{totals.premium.toLocaleString('nl-NL')}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">Extra bereik</p>
            <p className={`text-xl font-bold ${uplift >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {uplift >= 0 ? '+' : ''}
              {uplift.toFixed(0)}%
            </p>
          </div>
        </div>

        {/* Chart */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(d) =>
                  new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
                }
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(d) =>
                  new Date(d as string).toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'long',
                  })
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {sel && (
                <ReferenceLine
                  x={ymd(sel.start)}
                  stroke="hsl(var(--primary))"
                  strokeDasharray="4 4"
                  label={{ value: 'Start premium', position: 'top', fontSize: 10, fill: 'hsl(var(--primary))' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="baseline"
                name="Voor premium"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="premium"
                name="Tijdens premium"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {sel?.start.toLocaleDateString('nl-NL')} – {sel?.end.toLocaleDateString('nl-NL')}
          </Badge>
          <span>Baseline = even lange periode direct ervoor.</span>
        </div>
      </CardContent>
    </Card>
  );
}