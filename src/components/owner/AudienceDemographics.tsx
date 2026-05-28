import { useEffect, useState } from 'react';
import { Users, Globe, Smartphone, Monitor } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';

interface Stats {
  total: number;
  uniqueSessions: number;
  returningPct: number;
  byDevice: { mobile: number; desktop: number; other: number };
  byLang: Record<string, number>;
}

export function AudienceDemographics({ restaurantId }: { restaurantId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('analytics_events')
        .select('session_id, metadata, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', since)
        .limit(2000);

      const rows = data || [];
      const sessions = new Map<string, number>();
      const byDevice = { mobile: 0, desktop: 0, other: 0 };
      const byLang: Record<string, number> = {};
      rows.forEach((r: any) => {
        if (r.session_id) sessions.set(r.session_id, (sessions.get(r.session_id) || 0) + 1);
        const ua: string = r.metadata?.user_agent || r.metadata?.ua || '';
        if (/Mobi|Android|iPhone/i.test(ua)) byDevice.mobile++;
        else if (ua) byDevice.desktop++;
        else byDevice.other++;
        const lang: string = r.metadata?.language || r.metadata?.lang || '';
        if (lang) {
          const k = lang.slice(0, 2).toLowerCase();
          byLang[k] = (byLang[k] || 0) + 1;
        }
      });
      const returning = [...sessions.values()].filter((c) => c > 1).length;
      setStats({
        total: rows.length,
        uniqueSessions: sessions.size,
        returningPct: sessions.size ? Math.round((returning / sessions.size) * 100) : 0,
        byDevice,
        byLang,
      });
    })();
  }, [restaurantId]);

  if (!stats) return <Card><CardContent className="p-4 text-sm text-muted-foreground">Laden…</CardContent></Card>;

  if (stats.total === 0) {
    return (
      <Card><CardContent className="p-6 text-center">
        <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Nog geen bezoekersdata in de laatste 30 dagen.</p>
      </CardContent></Card>
    );
  }

  const totalDev = stats.byDevice.mobile + stats.byDevice.desktop + stats.byDevice.other || 1;
  const langEntries = Object.entries(stats.byLang).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Users className="h-4 w-4" />} label="Unieke bezoekers" value={stats.uniqueSessions.toString()} />
          <Stat icon={<Users className="h-4 w-4" />} label="Terugkerend" value={`${stats.returningPct}%`} />
          <Stat icon={<Globe className="h-4 w-4" />} label="Totaal events" value={stats.total.toString()} />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Apparaat</p>
          <div className="space-y-1.5">
            <Bar icon={<Smartphone className="h-3 w-3" />} label="Mobiel" pct={(stats.byDevice.mobile / totalDev) * 100} />
            <Bar icon={<Monitor className="h-3 w-3" />} label="Desktop" pct={(stats.byDevice.desktop / totalDev) * 100} />
          </div>
        </div>

        {langEntries.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Talen</p>
            <div className="flex flex-wrap gap-2">
              {langEntries.map(([k, v]) => (
                <span key={k} className="text-xs px-2 py-1 rounded bg-muted">{k.toUpperCase()} · {v}</span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="text-center p-2 rounded-lg border">
      <div className="flex items-center justify-center text-primary mb-1">{icon}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Bar({ icon, label, pct }: { icon: React.ReactNode; label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="flex items-center gap-1 w-20 text-muted-foreground">{icon} {label}</span>
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right font-medium">{pct.toFixed(0)}%</span>
    </div>
  );
}