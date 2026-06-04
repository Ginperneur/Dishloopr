import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Play, Pause, CheckCircle2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ResultRow = { id: string; name: string; status: string; provider?: string; url?: string };

export function ReservationLinkDetector() {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState({ processed: 0, found: 0, noProvider: 0, fetchFailed: 0, remaining: 0, total: 0 });
  const [recent, setRecent] = useState<ResultRow[]>([]);
  const [forceRefresh, setForceRefresh] = useState(false);

  const loadCounts = async () => {
    const { count: totalWithWebsite } = await supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .not('website_url', 'is', null);
    const { count: missing } = await supabase
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .not('website_url', 'is', null)
      .is('reservation_url', null)
      .is('zenchef_id', null);
    setStats(s => ({ ...s, total: totalWithWebsite || 0, remaining: missing || 0 }));
  };

  useEffect(() => { loadCounts(); }, []);

  const runBatch = async () => {
    const { data, error } = await supabase.functions.invoke('detect-reservation-links', {
      body: { batchSize: 25, forceRefresh },
    });
    if (error) throw error;
    const summary = data?.summary ?? { processed: 0, found: 0, no_provider: 0, fetch_failed: 0, remaining: 0 };
    const results: ResultRow[] = data?.results ?? [];
    setStats(s => ({
      ...s,
      processed: s.processed + summary.processed,
      found: s.found + summary.found,
      noProvider: s.noProvider + summary.no_provider,
      fetchFailed: s.fetchFailed + summary.fetch_failed,
      remaining: summary.remaining,
    }));
    setRecent(prev => [...results.filter(r => r.status === 'found'), ...prev].slice(0, 50));
    return summary;
  };

  const runAll = async () => {
    setRunning(true);
    setPaused(false);
    try {
      let consecutiveEmpty = 0;
      while (true) {
        if (paused) break;
        const summary = await runBatch();
        if (summary.processed === 0) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 2) break;
        } else {
          consecutiveEmpty = 0;
        }
        if (summary.remaining === 0 && !forceRefresh) break;
        // small pause to avoid hammering
        await new Promise(r => setTimeout(r, 500));
      }
      toast.success('Detectie voltooid');
    } catch (e) {
      toast.error('Fout tijdens detectie: ' + (e instanceof Error ? e.message : 'onbekend'));
    } finally {
      setRunning(false);
      loadCounts();
    }
  };

  const runOne = async () => {
    setRunning(true);
    try {
      await runBatch();
      toast.success('Batch verwerkt');
    } catch (e) {
      toast.error('Fout: ' + (e instanceof Error ? e.message : 'onbekend'));
    } finally {
      setRunning(false);
      loadCounts();
    }
  };

  const processed = stats.total - stats.remaining;
  const pct = stats.total > 0 ? Math.round((processed / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Reserveringslinks Detector
          </CardTitle>
          <CardDescription>
            Scant de website van elk restaurant en detecteert automatisch reserveringslinks van TheFork, Zenchef, Resy, OpenTable, Formitable, Quandoo, SevenRooms en meer. Resultaten worden direct opgeslagen in <code>reservation_url</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Totaal (met website)</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Nog te scannen</div>
              <div className="text-2xl font-bold text-orange-600">{stats.remaining}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Gevonden (sessie)</div>
              <div className="text-2xl font-bold text-green-600">{stats.found}</div>
            </div>
            <div className="rounded-lg border bg-card p-3">
              <div className="text-xs text-muted-foreground">Verwerkt (sessie)</div>
              <div className="text-2xl font-bold">{stats.processed}</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Voortgang database</span>
              <span className="font-medium">{pct}%</span>
            </div>
            <Progress value={pct} />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button onClick={runAll} disabled={running} className="gap-2">
              {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? 'Bezig...' : 'Scan alle restaurants'}
            </Button>
            <Button variant="outline" onClick={runOne} disabled={running} className="gap-2">
              <Play className="h-4 w-4" />
              Eén batch (25)
            </Button>
            {running && (
              <Button variant="outline" onClick={() => setPaused(true)} className="gap-2">
                <Pause className="h-4 w-4" /> Pauzeer
              </Button>
            )}
            <label className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
              <input type="checkbox" checked={forceRefresh} onChange={e => setForceRefresh(e.target.checked)} />
              Ook restaurants met bestaande link opnieuw scannen
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Geen provider: <span className="font-medium text-foreground">{stats.noProvider}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              Fetch mislukt: <span className="font-medium text-foreground">{stats.fetchFailed}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Laatst gevonden ({recent.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recent.map((r, i) => (
                <div key={`${r.id}-${i}`} className="flex items-center justify-between gap-2 p-2 rounded border bg-card">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{r.name}</div>
                    {r.url && <div className="text-xs text-muted-foreground truncate">{r.url}</div>}
                  </div>
                  {r.provider && <Badge variant="secondary" className="text-xs">{r.provider}</Badge>}
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}