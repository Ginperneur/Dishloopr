import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  restaurantId: string;
  restaurantName: string;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => escape((r as any)[h])).join(',')),
  ].join('\n');
}

function download(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type DatasetKey = 'cohorts' | 'attribution' | 'benchmark' | 'search_terms' | 'all';

export function InsightsExportButton({ restaurantId, restaurantName }: Props) {
  const [busy, setBusy] = useState<DatasetKey | null>(null);

  const slug = restaurantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const stamp = new Date().toISOString().slice(0, 10);

  const fetchCohorts = async () => {
    const { data, error } = await supabase.rpc('get_guest_cohorts', {
      p_restaurant_id: restaurantId,
      p_weeks: 8,
    });
    if (error) throw error;
    return (data ?? []) as Record<string, unknown>[];
  };

  const fetchAttribution = async () => {
    const { data, error } = await supabase.rpc('get_owner_attribution', {
      p_restaurant_id: restaurantId,
      p_days: 30,
    });
    if (error) throw error;
    return (data ?? []) as Record<string, unknown>[];
  };

  const fetchBenchmark = async () => {
    const { data, error } = await supabase.rpc('get_owner_historical_benchmark', {
      p_restaurant_id: restaurantId,
      p_days: 90,
    });
    if (error) throw error;
    return (data ?? []) as Record<string, unknown>[];
  };

  const fetchSearchTerms = async () => {
    const { data, error } = await (supabase as any)
      .from('analytics_events')
      .select('metadata, created_at')
      .eq('restaurant_id', restaurantId)
      .eq('event_type', 'search_term_match')
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
      .limit(1000);
    if (error) throw error;
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const term = String((row as any).metadata?.term ?? '').trim().toLowerCase();
      if (!term) continue;
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count);
  };

  const run = async (key: DatasetKey) => {
    setBusy(key);
    try {
      const tasks: Array<{ name: string; rows: Record<string, unknown>[] }> = [];
      if (key === 'cohorts' || key === 'all') tasks.push({ name: 'cohorts', rows: await fetchCohorts() });
      if (key === 'attribution' || key === 'all') tasks.push({ name: 'attribution', rows: await fetchAttribution() });
      if (key === 'benchmark' || key === 'all') tasks.push({ name: 'benchmark', rows: await fetchBenchmark() });
      if (key === 'search_terms' || key === 'all') tasks.push({ name: 'search-terms', rows: await fetchSearchTerms() });

      let downloaded = 0;
      for (const t of tasks) {
        if (!t.rows.length) continue;
        download(toCsv(t.rows), `dishloopr-${slug}-${t.name}-${stamp}.csv`);
        downloaded++;
      }
      if (!downloaded) {
        toast.info('Geen data om te exporteren in deze periode');
      } else {
        toast.success(`${downloaded} CSV-bestand${downloaded === 1 ? '' : 'en'} gedownload`);
      }
    } catch (err) {
      console.error('Insights export error:', err);
      toast.error('Export mislukt');
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={busy !== null}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Exporteer CSV
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Inzichten exporteren</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => run('all')}>Alles (alle datasets)</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => run('cohorts')}>Gasten-cohorten (8 wkn)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run('attribution')}>Kanaal-attributie (30d)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run('benchmark')}>Jaar-op-jaar benchmark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => run('search_terms')}>Zoektermen (30d)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
