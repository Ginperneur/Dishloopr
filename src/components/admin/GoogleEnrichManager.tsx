import { useState } from 'react';
import { Star, Loader2, Play, RefreshCw, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnrichResult {
  id: string;
  name: string;
  status: string;
  rating?: number;
  reviews?: number;
}

type EnrichMode = 'full' | 'opening_hours_only';

export function GoogleEnrichManager() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<EnrichResult[]>([]);
  const [stats, setStats] = useState({ enriched: 0, failed: 0, remaining: 0, total: 0 });
  const [batchesDone, setBatchesDone] = useState(0);
  const [activeMode, setActiveMode] = useState<EnrichMode>('full');

  const runBatch = async (batchSize = 25, mode: EnrichMode = 'full') => {
    setRunning(true);
    setActiveMode(mode);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-restaurants', {
        body: { batchSize, offset: 0, mode },
      });

      if (error) throw error;

      if (data.total === 0) {
        toast.info(mode === 'opening_hours_only'
          ? 'Geen restaurants meer zonder openingstijden!'
          : 'Geen restaurants meer om te verrijken!');
        setRunning(false);
        return;
      }

      setResults(prev => [...prev, ...(data.results || [])]);
      setStats(prev => ({
        enriched: prev.enriched + (data.enriched || 0),
        failed: prev.failed + (data.failed || 0),
        remaining: data.remaining || 0,
        total: prev.total + (data.total || 0),
      }));
      setBatchesDone(prev => prev + 1);

      toast.success(`Batch klaar: ${data.enriched} verrijkt, ${data.failed} mislukt, ${data.remaining} resterend`);
    } catch (err) {
      console.error('Enrich error:', err);
      toast.error('Fout bij verrijken: ' + (err instanceof Error ? err.message : 'Onbekend'));
    } finally {
      setRunning(false);
    }
  };

  const runAll = async (mode: EnrichMode = 'full') => {
    setResults([]);
    setStats({ enriched: 0, failed: 0, remaining: 999, total: 0 });
    setBatchesDone(0);
    setActiveMode(mode);
    const batchSize = 25;

    setRunning(true);
    try {
      while (true) {
        const { data, error } = await supabase.functions.invoke('enrich-restaurants', {
          body: { batchSize, offset: 0, mode },
        });

        if (error) throw error;

        setResults(prev => [...prev, ...(data.results || [])]);
        setStats(prev => ({
          enriched: prev.enriched + (data.enriched || 0),
          failed: prev.failed + (data.failed || 0),
          remaining: data.remaining || 0,
          total: prev.total + (data.total || 0),
        }));
        setBatchesDone(prev => prev + 1);

        if (data.remaining <= 0 || data.total === 0) {
          toast.success(mode === 'opening_hours_only'
            ? 'Alle openingstijden aangevuld!'
            : 'Alle restaurants verrijkt!');
          break;
        }
      }
    } catch (err) {
      console.error('Enrich error:', err);
      toast.error('Fout bij verrijken: ' + (err instanceof Error ? err.message : 'Onbekend'));
    } finally {
      setRunning(false);
    }
  };

  const progress = stats.total > 0 ? Math.round(((stats.enriched + stats.failed) / (stats.remaining + stats.enriched + stats.failed)) * 100) : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Google Data Verrijking
            </CardTitle>
            <CardDescription>
              Importeer Google ratings, reviews en openingstijden voor restaurants
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action buttons in two rows */}
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Volledige verrijking (rating + reviews + openingstijden)</p>
            <div className="flex gap-2">
              <Button onClick={() => runBatch(25, 'full')} disabled={running} variant="outline" size="sm">
                {running && activeMode === 'full' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                1 Batch (25)
              </Button>
              <Button onClick={() => runAll('full')} disabled={running} size="sm">
                {running && activeMode === 'full' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Alles verrijken
              </Button>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Alleen openingstijden (voor restaurants die al een rating hebben)</p>
            <div className="flex gap-2">
              <Button onClick={() => runBatch(25, 'opening_hours_only')} disabled={running} variant="outline" size="sm">
                {running && activeMode === 'opening_hours_only' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                1 Batch (25)
              </Button>
              <Button onClick={() => runAll('opening_hours_only')} disabled={running} variant="secondary" size="sm">
                {running && activeMode === 'opening_hours_only' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                Alle openingstijden
              </Button>
            </div>
          </div>
        </div>

        {(running || stats.total > 0) && (
          <>
            <Progress value={progress} className="h-2" />
            <div className="grid grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-green-500/10">
                <p className="text-xs text-muted-foreground">Verrijkt</p>
                <p className="text-2xl font-bold text-green-600">{stats.enriched}</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10">
                <p className="text-xs text-muted-foreground">Mislukt</p>
                <p className="text-2xl font-bold text-destructive">{stats.failed}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Resterend</p>
                <p className="text-2xl font-bold">{stats.remaining}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Batches</p>
                <p className="text-2xl font-bold">{batchesDone}</p>
              </div>
            </div>
          </>
        )}

        {results.length > 0 && (
          <div className="max-h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Google Rating</TableHead>
                  <TableHead>Reviews</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.slice(-50).map((r, i) => (
                  <TableRow key={`${r.id}-${i}`}>
                    <TableCell className="font-medium max-w-[200px] truncate">{r.name}</TableCell>
                    <TableCell>{r.rating ? `⭐ ${r.rating}` : '-'}</TableCell>
                    <TableCell>{r.reviews ?? '-'}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'enriched' ? 'default' : 'secondary'}>
                        {r.status === 'enriched' ? 'Verrijkt' :
                         r.status === 'not_found' ? 'Niet gevonden' :
                         r.status === 'no_details' ? 'Geen details' :
                         r.status === 'no_hours' ? 'Geen uren' : r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!running && stats.total === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Klik op een knop hierboven om Google data te importeren voor restaurants.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
