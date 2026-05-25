import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter, Eye, MousePointer, Target } from 'lucide-react';

interface FunnelData { views: number; clicks: number; conversions: number }

export function OwnerFunnel({ restaurantId, days = 30 }: { restaurantId: string; days?: number }) {
  const [data, setData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: rows, error } = await (supabase as any).rpc('get_owner_funnel', {
        p_restaurant_id: restaurantId, p_days: days,
      });
      if (!error && rows?.[0]) {
        setData({
          views: Number(rows[0].views) || 0,
          clicks: Number(rows[0].clicks) || 0,
          conversions: Number(rows[0].conversions) || 0,
        });
      } else {
        setData({ views: 0, clicks: 0, conversions: 0 });
      }
      setLoading(false);
    })();
  }, [restaurantId, days]);

  if (loading || !data) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Funnel laden…</CardContent></Card>;
  }

  const max = Math.max(data.views, 1);
  const ctr = data.views > 0 ? Math.round((data.clicks / data.views) * 100) : 0;
  const cvr = data.clicks > 0 ? Math.round((data.conversions / data.clicks) * 100) : 0;

  const Row = ({ icon: Icon, label, value, pct, color }: any) => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><span>{label}</span></div>
        <span className="font-semibold tabular-nums">{value.toLocaleString('nl-NL')}</span>
      </div>
      <div className="h-3 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Filter className="h-5 w-5 text-primary" />
          Conversie-funnel <span className="text-xs font-normal text-muted-foreground">· laatste {days} dagen</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <Row icon={Eye} label="Profielweergaven" value={data.views} color="bg-primary" />
        <div className="flex justify-end text-xs text-muted-foreground">↓ klik-ratio: <span className="ml-1 font-medium text-foreground">{ctr}%</span></div>
        <Row icon={MousePointer} label="Interactie-clicks" value={data.clicks} color="bg-primary/70" />
        <div className="flex justify-end text-xs text-muted-foreground">↓ conversie-ratio: <span className="ml-1 font-medium text-foreground">{cvr}%</span></div>
        <Row icon={Target} label="Conversies (website/telefoon/reservering)" value={data.conversions} color="bg-green-500" />
      </CardContent>
    </Card>
  );
}