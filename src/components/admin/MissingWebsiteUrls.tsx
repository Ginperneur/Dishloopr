import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Globe, RefreshCw, Play, Search, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Row {
  id: string;
  name: string;
  address: string | null;
  city: { name: string } | null;
  google_enriched_at: string | null;
}

export function MissingWebsiteUrls() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ enriched: 0, failed: 0, processed: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ count }, { data }] = await Promise.all([
      supabase
        .from('restaurants')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .is('website_url', null),
      supabase
        .from('restaurants')
        .select('id, name, address, google_enriched_at, city:cities(name)')
        .eq('is_active', true)
        .is('website_url', null)
        .order('name')
        .limit(300),
    ]);
    setTotal(count || 0);
    setRows((data as unknown as Row[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const runBatch = async (batchSize = 25) => {
    const { data, error } = await supabase.functions.invoke('enrich-restaurants', {
      body: { batchSize, offset: 0, mode: 'missing_website_only' },
    });
    if (error) throw error;
    return data;
  };

  const runAll = async () => {
    setRunning(true);
    setStats({ enriched: 0, failed: 0, processed: 0 });
    try {
      while (true) {
        const d = await runBatch(25);
        const e = d?.enriched || 0;
        const f = d?.failed || 0;
        const t = d?.total || 0;
        setStats(s => ({ enriched: s.enriched + e, failed: s.failed + f, processed: s.processed + t }));
        if (!d?.remaining || d.remaining <= 0 || t === 0) break;
      }
      toast.success('Klaar — websites aangevuld vanuit Google Places');
    } catch (e) {
      toast.error('Fout: ' + (e instanceof Error ? e.message : 'onbekend'));
    } finally {
      setRunning(false);
      load();
    }
  };

  const runOne = async () => {
    setRunning(true);
    try {
      const d = await runBatch(25);
      setStats(s => ({
        enriched: s.enriched + (d?.enriched || 0),
        failed: s.failed + (d?.failed || 0),
        processed: s.processed + (d?.total || 0),
      }));
      toast.success(`Batch klaar: ${d?.enriched || 0} aangevuld, ${d?.failed || 0} mislukt`);
    } catch (e) {
      toast.error('Fout: ' + (e instanceof Error ? e.message : 'onbekend'));
    } finally {
      setRunning(false);
      load();
    }
  };

  const pct = stats.processed > 0 && total > 0
    ? Math.round((stats.processed / (total + stats.processed)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Restaurants zonder website-URL ({total})
          </CardTitle>
          <CardDescription>
            Actieve restaurants waarvan geen website is ingevuld. Vul automatisch aan via Google Places — Google retourneert vaak een officiële website bij het restaurant. Eerdere mislukte pogingen worden geskipt (rating wordt op 0 gezet als sentinel).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Zonder website" value={total} />
            <Stat label="Aangevuld (sessie)" value={stats.enriched} tone="green" />
            <Stat label="Mislukt (sessie)" value={stats.failed} tone="red" />
            <Stat label="Verwerkt (sessie)" value={stats.processed} />
          </div>

          {running && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Voortgang</span><span>{pct}%</span>
              </div>
              <Progress value={pct} />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={runAll} disabled={running || total === 0} className="gap-2">
              {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {running ? 'Bezig…' : 'Alle aanvullen via Google Places'}
            </Button>
            <Button onClick={runOne} disabled={running || total === 0} variant="outline" className="gap-2">
              <Play className="h-4 w-4" /> Eén batch (25)
            </Button>
            <Button onClick={load} variant="ghost" className="gap-2 ml-auto">
              <RefreshCw className="h-4 w-4" /> Ververs
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eerste 300 zonder website</CardTitle>
          <CardDescription>Sorteer op naam. Vorige Google-poging staat in de laatste kolom.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Laden…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Geen restaurants zonder website 🎉</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Stad</TableHead>
                    <TableHead>Adres</TableHead>
                    <TableHead>Laatste Google-poging</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.city?.name ?? '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{r.address ?? '—'}</TableCell>
                      <TableCell className="text-xs">
                        {r.google_enriched_at
                          ? new Date(r.google_enriched_at).toLocaleDateString('nl-NL')
                          : <Badge variant="secondary">nooit</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <a
                          href={`/restaurant/${r.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          bekijk <ExternalLink className="h-3 w-3" />
                        </a>
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

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-green-600' : tone === 'red' ? 'text-red-600' : 'text-foreground';
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value.toLocaleString('nl-NL')}</div>
    </div>
  );
}