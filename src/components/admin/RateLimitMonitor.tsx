import { useEffect, useState } from 'react';
import { Shield, ShieldOff, Sparkles, RefreshCw, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UsageRow {
  function_name: string;
  calls_last_hour: number;
  calls_last_24h: number;
  unique_callers_24h: number;
}

interface TopAbuser {
  identifier: string;
  function_name: string;
  calls: number;
}

export function RateLimitMonitor() {
  const [rateLimitEnabled, setRateLimitEnabled] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [abusers, setAbusers] = useState<TopAbuser[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: settings } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['rate_limiting_enabled', 'ai_features_enabled']);
      const map = new Map<string, unknown>();
      (settings ?? []).forEach((s: any) => map.set(s.key, s.value));
      setRateLimitEnabled(map.get('rate_limiting_enabled') !== false);
      setAiEnabled(map.get('ai_features_enabled') !== false);

      // Usage stats (last 24h)
      const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const since1h = new Date(Date.now() - 3600 * 1000).toISOString();
      const { data: rows } = await supabase
        .from('rate_limit_log')
        .select('function_name, identifier, created_at')
        .gte('created_at', since24h);

      const grouped = new Map<string, { h1: number; h24: number; callers: Set<string> }>();
      (rows ?? []).forEach((r: any) => {
        const g = grouped.get(r.function_name) ?? { h1: 0, h24: 0, callers: new Set<string>() };
        g.h24++;
        if (r.created_at >= since1h) g.h1++;
        g.callers.add(r.identifier);
        grouped.set(r.function_name, g);
      });
      const usageRows: UsageRow[] = Array.from(grouped.entries())
        .map(([function_name, g]) => ({
          function_name,
          calls_last_hour: g.h1,
          calls_last_24h: g.h24,
          unique_callers_24h: g.callers.size,
        }))
        .sort((a, b) => b.calls_last_24h - a.calls_last_24h);
      setUsage(usageRows);

      // Top abusers (last hour)
      const abuseMap = new Map<string, number>();
      (rows ?? [])
        .filter((r: any) => r.created_at >= since1h)
        .forEach((r: any) => {
          const key = `${r.identifier}|${r.function_name}`;
          abuseMap.set(key, (abuseMap.get(key) ?? 0) + 1);
        });
      const top: TopAbuser[] = Array.from(abuseMap.entries())
        .map(([k, calls]) => {
          const [identifier, function_name] = k.split('|');
          return { identifier, function_name, calls };
        })
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 15);
      setAbusers(top);
    } catch (e: any) {
      console.error(e);
      toast.error('Laden mislukt: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateSetting = async (key: 'rate_limiting_enabled' | 'ai_features_enabled', value: boolean) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value: value as any }, { onConflict: 'key' });
      if (error) throw error;
      if (key === 'rate_limiting_enabled') setRateLimitEnabled(value);
      else setAiEnabled(value);
      toast.success(`${key} = ${value}`);
    } catch (e: any) {
      toast.error('Bijwerken mislukt: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            API Bescherming & Rate Limits
          </CardTitle>
          <CardDescription>
            Beschermt AI- en publieke edge functions tegen misbruik en hoge kosten. Wijzigingen worden direct toegepast op alle edge functions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
            <div className="flex items-start gap-3">
              <Shield className={`h-5 w-5 mt-0.5 ${rateLimitEnabled ? 'text-green-600' : 'text-muted-foreground'}`} />
              <div>
                <div className="font-medium">Rate limiting actief</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Limiteert hoeveel calls een user/IP per uur of dag mag doen. Uitzetten = geen bescherming.
                </p>
              </div>
            </div>
            <Switch checked={rateLimitEnabled} disabled={saving} onCheckedChange={(v) => updateSetting('rate_limiting_enabled', v)} />
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
            <div className="flex items-start gap-3">
              <Sparkles className={`h-5 w-5 mt-0.5 ${aiEnabled ? 'text-orange-500' : 'text-muted-foreground'}`} />
              <div>
                <div className="font-medium flex items-center gap-2">
                  AI-functies ingeschakeld
                  {!aiEnabled && <Badge variant="destructive" className="text-[10px]">UIT</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Kill-switch voor alle AI calls (Surprise Me, support chat, menu parser, etc.). Zet uit bij onverwachte kosten.
                </p>
              </div>
            </div>
            <Switch checked={aiEnabled} disabled={saving} onCheckedChange={(v) => updateSetting('ai_features_enabled', v)} />
          </div>

          {!aiEnabled && (
            <div className="flex items-start gap-2 p-3 rounded border border-orange-500/30 bg-orange-500/5 text-sm">
              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <div>
                <strong>AI staat uit.</strong> Surprise Me, support chat, menu-scanner en review-analyse geven nu een 503-fout.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Gebruik per functie (laatste 24u)
            </CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Ververs
          </Button>
        </CardHeader>
        <CardContent>
          {usage.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nog geen activiteit geregistreerd.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2 px-2">Functie</th>
                    <th className="text-right py-2 px-2">Afgelopen uur</th>
                    <th className="text-right py-2 px-2">Afgelopen 24u</th>
                    <th className="text-right py-2 px-2">Unieke callers</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((r) => (
                    <tr key={r.function_name} className="border-b">
                      <td className="py-2 px-2 font-mono text-xs">{r.function_name}</td>
                      <td className="text-right py-2 px-2">{r.calls_last_hour}</td>
                      <td className="text-right py-2 px-2 font-medium">{r.calls_last_24h}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground">{r.unique_callers_24h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {abusers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Top callers (laatste uur)
            </CardTitle>
            <CardDescription className="text-xs">
              IP- of user-IDs die het meeste aanroepen. Bij verdacht gedrag kun je het IP blokkeren via je hosting.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {abusers.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 rounded border bg-card">
                  <div className="font-mono truncate flex-1">{a.identifier}</div>
                  <Badge variant="outline" className="mx-2 text-[10px]">{a.function_name}</Badge>
                  <span className="font-bold tabular-nums">{a.calls}×</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}