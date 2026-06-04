import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Trash2, AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

import { openConfirm } from '@/components/ui/confirm-dialog';
interface ErrorLog {
  id: string;
  message: string;
  stack: string | null;
  component_stack: string | null;
  route: string | null;
  user_agent: string | null;
  app_version: string | null;
  created_at: string;
  user_id: string | null;
}

const RANGES: Record<string, number> = {
  '24h': 1,
  '7d': 7,
  '30d': 30,
  'all': 0,
};

export function ErrorLogsViewer() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState('7d');
  const [routeFilter, setRouteFilter] = useState<string>('all');
  const [selected, setSelected] = useState<ErrorLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    const days = RANGES[range];
    if (days > 0) {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('created_at', since);
    }
    const { data, error } = await query;
    if (error) {
      toast.error('Kon error logs niet laden');
    } else {
      setLogs((data as ErrorLog[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const routes = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => l.route && set.add(l.route.split('?')[0]));
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (routeFilter !== 'all' && (l.route?.split('?')[0] || '') !== routeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          l.message.toLowerCase().includes(q) ||
          (l.stack || '').toLowerCase().includes(q) ||
          (l.route || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [logs, search, routeFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { count: number; last: string; sample: ErrorLog }>();
    filtered.forEach((l) => {
      const key = l.message.slice(0, 200);
      const existing = map.get(key);
      if (existing) {
        existing.count++;
        if (l.created_at > existing.last) existing.last = l.created_at;
      } else {
        map.set(key, { count: 1, last: l.created_at, sample: l });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('error_logs').delete().eq('id', id);
    if (error) {
      toast.error('Kon niet verwijderen');
    } else {
      setLogs((prev) => prev.filter((l) => l.id !== id));
      toast.success('Verwijderd');
    }
  };

  const handleClearAll = async () => {
    if (!(await openConfirm(`Verwijder alle ${filtered.length} zichtbare logs?`))) return;
    const ids = filtered.map((l) => l.id);
    const { error } = await supabase.from('error_logs').delete().in('id', ids);
    if (error) {
      toast.error('Kon niet verwijderen');
    } else {
      setLogs((prev) => prev.filter((l) => !ids.includes(l.id)));
      toast.success(`${ids.length} logs verwijderd`);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Frontend Errors
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {filtered.length} logs · {grouped.length} unieke errors
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" variant="destructive" onClick={handleClearAll} disabled={filtered.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              Wis zichtbaar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Zoek in message, stack of route..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24 uur</SelectItem>
                <SelectItem value="7d">7 dagen</SelectItem>
                <SelectItem value="30d">30 dagen</SelectItem>
                <SelectItem value="all">Alles</SelectItem>
              </SelectContent>
            </Select>
            <Select value={routeFilter} onValueChange={setRouteFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Route" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle routes</SelectItem>
                {routes.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="hidden md:table-cell">Route</TableHead>
                  <TableHead className="hidden md:table-cell">Laatst</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {loading ? 'Laden...' : 'Geen errors 🎉'}
                    </TableCell>
                  </TableRow>
                ) : grouped.map((g) => (
                  <TableRow key={g.sample.id} className="cursor-pointer" onClick={() => setSelected(g.sample)}>
                    <TableCell>
                      <Badge variant={g.count > 5 ? 'destructive' : 'secondary'}>{g.count}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs max-w-md truncate">{g.sample.message}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{g.sample.route || '—'}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(g.last), { addSuffix: true, locale: nl })}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelected(g.sample); }}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="text-sm font-mono break-all">{selected?.message}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Route:</span> {selected.route || '—'}</div>
                <div><span className="text-muted-foreground">Versie:</span> {selected.app_version || '—'}</div>
                <div className="col-span-2"><span className="text-muted-foreground">User-Agent:</span> {selected.user_agent || '—'}</div>
                <div><span className="text-muted-foreground">Tijd:</span> {new Date(selected.created_at).toLocaleString('nl-NL')}</div>
                <div><span className="text-muted-foreground">User ID:</span> {selected.user_id || 'anoniem'}</div>
              </div>
              {selected.stack && (
                <div>
                  <div className="font-semibold mb-1">Stack</div>
                  <pre className="bg-muted p-3 rounded text-[10px] overflow-auto max-h-64">{selected.stack}</pre>
                </div>
              )}
              {selected.component_stack && (
                <div>
                  <div className="font-semibold mb-1">Component Stack</div>
                  <pre className="bg-muted p-3 rounded text-[10px] overflow-auto max-h-64">{selected.component_stack}</pre>
                </div>
              )}
              <Button variant="destructive" size="sm" onClick={() => { handleDelete(selected.id); setSelected(null); }}>
                <Trash2 className="h-4 w-4 mr-2" />Verwijder
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}