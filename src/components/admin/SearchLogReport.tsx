import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Download, Loader2 } from 'lucide-react';
import { csvEscape } from '@/lib/searchLog';

interface Row {
  zoekterm: string; zoekopdrachten: number; sessies: number; zonder_resultaat: number;
  gem_resultaten: number | null; klikken: number; steden: string | null; laatst: string;
}
const PERIODS = [1, 7, 30, 90];
const COLS: [keyof Row, string][] = [
  ['zoekterm', 'Zoekterm'], ['zoekopdrachten', 'Zoekopdrachten'], ['sessies', 'Sessies'],
  ['zonder_resultaat', 'Zonder resultaat'], ['gem_resultaten', 'Gem. resultaten'],
  ['klikken', 'Klikken'], ['steden', 'Steden'], ['laatst', 'Laatst'],
];
const fmtDate = (s: string) => new Date(s).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' });

export function SearchLogReport() {
  const [days, setDays] = useState(7);
  const [onlyZero, setOnlyZero] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true); setError(null);
    supabase.rpc('search_log_report' as any, { p_days: days, p_only_zero: onlyZero }).then(({ data, error }) => {
      if (cancel) return;
      if (error) setError(error.message); else setRows((data as Row[]) || []);
      setLoading(false);
    });
    return () => { cancel = true; };
  }, [days, onlyZero]);

  const exportCsv = () => {
    const lines = [COLS.map(c => csvEscape(c[1])).join(',')];
    for (const r of rows) lines.push(COLS.map(([k]) => csvEscape(r[k])).join(','));
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `zoeklog-${days}d${onlyZero ? '-zonder-resultaat' : ''}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <Button key={p} size="sm" variant={days === p ? 'default' : 'outline'} onClick={() => setDays(p)}>
              {p} {p === 1 ? 'dag' : 'dagen'}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Switch id="only-zero" checked={onlyZero} onCheckedChange={setOnlyZero} />
          <Label htmlFor="only-zero">Alleen zonder resultaat</Label>
        </div>
        <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv} disabled={!rows.length}>
          <Download className="h-4 w-4 mr-2" /> CSV
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">Geen zoekopdrachten in deze periode.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>{COLS.map(([k, l]) => <th key={k} className="text-left font-medium px-3 py-2 whitespace-nowrap">{l}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.zoekterm} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{r.zoekterm || <span className="text-muted-foreground">(leeg)</span>}</td>
                  <td className="px-3 py-2">{r.zoekopdrachten}</td>
                  <td className="px-3 py-2">{r.sessies}</td>
                  <td className={`px-3 py-2 ${r.zonder_resultaat > 0 ? 'text-destructive font-medium' : ''}`}>{r.zonder_resultaat}</td>
                  <td className="px-3 py-2">{r.gem_resultaten ?? '–'}</td>
                  <td className="px-3 py-2">{r.klikken}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.steden || '–'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(r.laatst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
