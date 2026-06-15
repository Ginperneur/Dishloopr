import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Globe, Play, Pause, RefreshCw, ExternalLink, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Status = 'ok' | 'redirect' | 'broken' | 'timeout';

interface DeadRow {
  id: string;
  name: string;
  website_url: string;
  website_status: Status;
  website_status_code: number | null;
  website_checked_at: string | null;
  city?: { name: string } | null;
}

export function LinkHealthChecker() {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [batchSize, setBatchSize] = useState(50);
  const [recheckDays, setRecheckDays] = useState(30);
  const [stats, setStats] = useState({
    total: 0,
    checked: 0,
    ok: 0,
    redirect: 0,
    broken: 0,
    timeout: 0,
    remaining: 0,
    sessionProcessed: 0,
  });
  const [deadLinks, setDeadLinks] = useState<DeadRow[]>([]);
  const [loadingDead, setLoadingDead] = useState(false);

  const loadCounts = useCallback(async () => {
    const cutoff = new Date(Date.now() - recheckDays * 24 * 60 * 60 * 1000).toISOString();
    const [totalRes, checkedRes, okRes, redRes, brokenRes, timeoutRes, remainingRes] = await Promise.all([
      supabase.from('restaurants').select('id', { count: 'exact', head: true }).not('website_url', 'is', null).eq('is_active', true),
      supabase.from('restaurants').select('id', { count: 'exact', head: true }).not('website_url', 'is', null).eq('is_active', true).not('website_checked_at', 'is', null),
      supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('website_status', 'ok'),
      supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('website_status', 'redirect'),
      supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('website_status', 'broken'),
      supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('website_status', 'timeout'),
      supabase.from('restaurants').select('id', { count: 'exact', head: true }).not('website_url', 'is', null).eq('is_active', true).or(`website_checked_at.is.null,website_checked_at.lt.${cutoff}`),
    ]);
    setStats(s => ({
      ...s,
      total: totalRes.count || 0,
      checked: checkedRes.count || 0,
      ok: okRes.count || 0,
      redirect: redRes.count || 0,
      broken: brokenRes.count || 0,
      timeout: timeoutRes.count || 0,
      remaining: remainingRes.count || 0,
    }));
  }, [recheckDays]);

  const loadDeadLinks = useCallback(async () => {
    setLoadingDead(true);
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, website_url, website_status, website_status_code, website_checked_at, city:cities(name)')
      .in('website_status', ['broken', 'timeout'])
      .eq('is_active', true)
      .order('website_checked_at', { ascending: false })
      .limit(300);
    if (!error && data) setDeadLinks(data as unknown as DeadRow[]);
    setLoadingDead(false);
  }, []);

  useEffect(() => {
    loadCounts();
    loadDeadLinks();
  }, [loadCounts, loadDeadLinks]);

  const runBatch = async (force = false) => {
    const { data, error } = await supabase.functions.invoke('link-health-checker', {
      body: { batchSize, recheckOlderThanDays: recheckDays, forceRecheck: force },
    });
    if (error) throw error;
    const s = data?.summary ?? { processed: 0, ok: 0, redirect: 0, broken: 0, timeout: 0, remaining: 0 };
    setStats(prev => ({
      ...prev,
      sessionProcessed: prev.sessionProcessed + s.processed,
      remaining: s.remaining,
    }));
    return s;
  };

  const runAll = async () => {
    setRunning(true);
    setPaused(false);
    try {
      let consecutiveEmpty = 0;
      while (true) {
        if (paused) break;
        const s = await runBatch(false);
        if (s.processed === 0) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 2) break;
        } else consecutiveEmpty = 0;
        if (s.remaining === 0) break;
        await new Promise(r => setTimeout(r, 400));
      }
      toast.success('Link-scan voltooid');
    } catch (e) {
      toast.error('Fout: ' + (e instanceof Error ? e.message : 'onbekend'));
    } finally {
      setRunning(false);
      await Promise.all([loadCounts(), loadDeadLinks()]);
    }
  };

  const runOne = async () => {
    setRunning(true);
    try {
      await runBatch(false);
      toast.success('Batch verwerkt');
    } catch (e) {
      toast.error('Fout: ' + (e instanceof Error ? e.message : 'onbekend'));
    } finally {
      setRunning(false);
      await Promise.all([loadCounts(), loadDeadLinks()]);
    }
  };

  const clearWebsite = async (id: string) => {
    if (!confirm('Website-URL leegmaken voor dit restaurant?')) return;
    const { error } = await supabase
      .from('restaurants')
      .update({ website_url: null, website_status: null, website_status_code: null })
      .eq('id', id);
    if (error) {
      toast.error('Verwijderen mislukt');
      return;
    }
    setDeadLinks(d => d.filter(r => r.id !== id));
    toast.success('Website-URL verwijderd');
    loadCounts();
  };

  const pct = stats.total > 0 ? Math.round((stats.checked / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Link Health Checker
          </CardTitle>
          <CardDescription>
            Controleert of de <code>website_url</code> van elk actief restaurant nog werkt. Resultaat wordt opgeslagen in <code>website_status</code> (<code>ok</code>, <code>redirect</code>, <code>broken</code>, <code>timeout</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <Stat label="Totaal" value={stats.total} />
            <Stat label="Gecontroleerd" value={stats.checked} />
            <Stat label="OK" value={stats.ok} tone="green" />
            <Stat label="Redirect" value={stats.redirect} tone="amber" />
            <Stat label="Broken" value={stats.broken} tone="red" />
            <Stat label="Timeout" value={stats.timeout} tone="red" />
            <Stat label="Te scannen" value={stats.remaining} tone="amber" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Voortgang database</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <Progress value={pct} />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="batch" className="text-xs">Batch (1-100)</Label>
              <Input
                id="batch"
                type="number"
                min={1}
                max={100}
                value={batchSize}
                onChange={e => setBatchSize(Math.min(100, Math.max(1, Number(e.target.value) || 50)))}
                className="w-24"
              />
            </div>
            <div>
              <Label htmlFor="days" className="text-xs">Hercontroleer na (dagen)</Label>
              <Input
                id="days"
                type="number"
                min={1}
                max={365}
                value={recheckDays}
                onChange={e => setRecheckDays(Math.max(1, Number(e.target.value) || 30))}
                className="w-24"
              />
            </div>
            <Button onClick={runAll} disabled={running} className="gap-2">
              {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? `Bezig... (${stats.sessionProcessed})` : 'Scan alle restaurants'}
            </Button>
            <Button variant="outline" onClick={runOne} disabled={running} className="gap-2">
              <Play className="h-4 w-4" />
              Eén batch
            </Button>
            {running && (
              <Button variant="outline" onClick={() => setPaused(true)} className="gap-2">
                <Pause className="h-4 w-4" /> Pauzeer
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => { loadCounts(); loadDeadLinks(); }}
              className="gap-2 ml-auto"
            >
              <RefreshCw className="h-4 w-4" /> Ververs
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Dode links ({deadLinks.length})
          </CardTitle>
          <CardDescription>
            Restaurants waarvan de website onbereikbaar is (broken of timeout). Open de link om handmatig te checken of verwijder de URL zodat hij niet meer op de site staat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingDead ? (
            <div className="text-sm text-muted-foreground">Laden...</div>
          ) : deadLinks.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Geen dode links gevonden.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Stad</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Gecontroleerd</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deadLinks.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.city?.name ?? '—'}</TableCell>
                      <TableCell>
                        <Badge variant={r.website_status === 'timeout' ? 'secondary' : 'destructive'}>
                          {r.website_status}
                          {r.website_status_code ? ` ${r.website_status_code}` : ''}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        <a
                          href={r.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        >
                          {r.website_url}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.website_checked_at ? new Date(r.website_checked_at).toLocaleString('nl-NL') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => clearWebsite(r.id)}
                          className="gap-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" /> URL wissen
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'amber' | 'red' }) {
  const color =
    tone === 'green' ? 'text-green-600'
    : tone === 'amber' ? 'text-orange-600'
    : tone === 'red' ? 'text-red-600'
    : 'text-foreground';
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value.toLocaleString('nl-NL')}</div>
    </div>
  );
}