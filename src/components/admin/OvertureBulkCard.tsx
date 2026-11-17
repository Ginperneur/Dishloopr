import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Play, Power, Square, Upload } from 'lucide-react';
import { parseCsvTable } from '@/lib/overtureImport';

const DISH_COLUMNS = ['overture_id', 'dish_slug', 'dish_name', 'canonical_slug', 'course', 'tier', 'price'];
const DISH_BATCH = 500;
const SCRAPE_PARALLEL = 3;

async function bulk<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('overture-bulk', { body });
  if (error) throw new Error(error.message);
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

// Bulk route for Overture "zeker goed" (docs/overture-uitrol.md):
// 1. create the restaurants, hidden until they have 5 approved dishes;
// 2. import the screened Python scrape (scripts/overture-discovery/build_dish_import.py);
// 3. scrape the rest with the website pipeline, screened automatically by dish-screening.
// Restaurants switch on by themselves through the restaurant_dishes trigger.
interface PipelineState { enabled: boolean; last_tick_at: string | null; last_result: Record<string, unknown> | null }

// overture_pipeline is newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pipelineTable = () => (supabase as any).from('overture_pipeline');

export function OvertureBulkCard({ onDone }: { onDone: () => Promise<void> | void }) {
  const [busy, setBusy] = useState<null | 'create' | 'import' | 'scrape'>(null);
  const [log, setLog] = useState<string[]>([]);
  const [pipeline, setPipeline] = useState<PipelineState | null>(null);
  const stop = useRef(false);
  const say = (line: string) => setLog((l) => [line, ...l].slice(0, 12));

  const loadPipeline = useCallback(async () => {
    const { data } = await pipelineTable().select('enabled, last_tick_at, last_result').eq('id', 1).maybeSingle();
    setPipeline(data ?? null);
  }, []);
  useEffect(() => {
    loadPipeline();
    const t = setInterval(loadPipeline, 30_000);
    return () => clearInterval(t);
  }, [loadPipeline]);

  const togglePipeline = async () => {
    const next = !pipeline?.enabled;
    const { error } = await pipelineTable().update({ enabled: next, updated_at: new Date().toISOString() }).eq('id', 1);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? 'Server-pijplijn staat aan' : 'Server-pijplijn staat uit');
    await loadPipeline();
  };

  const run = async (kind: 'create' | 'import' | 'scrape', fn: () => Promise<void>) => {
    stop.current = false;
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
      say(`Fout: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
      await onDone();
    }
  };

  const createAll = () => run('create', async () => {
    let created = 0, duplicates = 0, failed = 0;
    for (;;) {
      if (stop.current) { say('Gestopt.'); return; }
      const r = await bulk<{ created: number; duplicates: number; failed: unknown[]; remaining: number }>(
        { action: 'create', triage: 'verified', limit: 15 });
      created += r.created; duplicates += r.duplicates; failed += r.failed.length;
      say(`Aangemaakt ${created}, al bekend ${duplicates}, naar twijfel ${failed}; nog ${r.remaining} te gaan`);
      if (r.remaining === 0 || r.created + r.duplicates + r.failed.length === 0) break;
    }
    toast.success(`Klaar: ${created} restaurants aangemaakt (verborgen tot 5 gerechten)`);
  });

  const importFile = (file: File | undefined) => file && run('import', async () => {
    const { header, rows } = parseCsvTable(await file.text());
    const missing = DISH_COLUMNS.filter((c) => !header.includes(c));
    if (missing.length) throw new Error(`Kolommen ontbreken: ${missing.join(', ')}`);
    let added = 0, created = 0, existing = 0, unknown = 0;
    for (let i = 0; i < rows.length; i += DISH_BATCH) {
      if (stop.current) { say('Gestopt.'); return; }
      const r = await bulk<{ links_added: number; dishes_created: number; links_existing: number; missing_restaurants: number }>(
        { action: 'import_dishes', rows: rows.slice(i, i + DISH_BATCH) });
      added += r.links_added; created += r.dishes_created; existing += r.links_existing; unknown += r.missing_restaurants;
      say(`${Math.min(i + DISH_BATCH, rows.length)}/${rows.length} rijen: ${added} gekoppeld, ${created} nieuwe gerechten, ${existing} stonden er al, ${unknown} restaurants onbekend`);
    }
    toast.success(`Import klaar: ${added} gerechten gekoppeld`);
  });

  const scrapeRest = () => run('scrape', async () => {
    let done = 0;
    const tried = new Set<string>(); // a scrape that fails before logging a run would come back forever
    for (;;) {
      if (stop.current) { say('Gestopt.'); return; }
      const res = await bulk<{ queue: { id: string; name: string; website_url: string }[] }>(
        { action: 'scrape_queue', limit: 12, exclude: [...tried] });
      const queue = res.queue.filter((r) => !tried.has(r.id));
      if (!queue.length) break;
      queue.forEach((r) => tried.add(r.id));
      for (let i = 0; i < queue.length; i += SCRAPE_PARALLEL) {
        if (stop.current) { say('Gestopt.'); return; }
        const part = queue.slice(i, i + SCRAPE_PARALLEL);
        await Promise.all(part.map((r) => supabase.functions.invoke('scrape-menu', {
          body: { restaurantId: r.id, websiteUrl: r.website_url },
        })));
        await supabase.functions.invoke('dish-screening', { body: { restaurantIds: part.map((r) => r.id), batchSize: 600 } });
        done += part.length;
        say(`Websiteroute: ${done} gescand (laatste: ${part.map((r) => r.name).join(', ')})`);
      }
    }
    toast.success(`Websiteroute klaar: ${done} restaurants gescand`);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Overture in bulk: zeker goed</CardTitle>
        <CardDescription>
          Doe de stappen op volgorde. Restaurants blijven verborgen en gaan vanzelf live zodra ze 5 goedgekeurde
          gerechten hebben (drank telt niet mee). Houd dit tabblad open zolang een stap loopt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={createAll} disabled={!!busy}>
            {busy === 'create' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            1. Alle zeker goed aanmaken
          </Button>
          <div className="flex items-center gap-2">
            <Label htmlFor="dish-import" className="text-sm">2. Python-gerechten (CSV)</Label>
            <Input id="dish-import" type="file" accept=".csv" className="w-64" disabled={!!busy}
              onChange={(e) => { importFile(e.target.files?.[0]); e.target.value = ''; }} />
            {busy === 'import' && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
          <Button variant="secondary" onClick={scrapeRest} disabled={!!busy}>
            {busy === 'scrape' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            3. Websiteroute voor de rest
          </Button>
          {busy && (
            <Button variant="outline" onClick={() => { stop.current = true; }}>
              <Square className="mr-2 h-4 w-4" /> Stoppen
            </Button>
          )}
        </div>
        <div className="rounded-md border p-3 text-sm space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant={pipeline?.enabled ? 'destructive' : 'default'} onClick={togglePipeline} disabled={!pipeline}>
              <Power className="mr-2 h-4 w-4" />
              {pipeline?.enabled ? 'Server-pijplijn uitzetten' : 'Server-pijplijn aanzetten'}
            </Button>
            <span className="text-muted-foreground">
              {pipeline ? (pipeline.enabled ? 'Aan: elke minuut een stap op de server, tabblad mag dicht.' : 'Uit.') : 'Nog niet beschikbaar (migratie 0056).'}
            </span>
          </div>
          <p className="text-muted-foreground">
            Doet zelf stap 1 en daarna stap 3, zonder open tabblad. Zet hem pas aan nadat de Python-gerechten (stap 2) zijn geïmporteerd.
          </p>
          {pipeline?.last_tick_at && (
            <p className="text-muted-foreground">
              Laatste stap {new Date(pipeline.last_tick_at).toLocaleTimeString('nl-NL')}: {JSON.stringify(pipeline.last_result)}
            </p>
          )}
        </div>
        {log.length > 0 && (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
