import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';

// These RPCs (migration 20261106170000) are not in the generated types yet.
const rpc = supabase.rpc as any;
const nf = new Intl.NumberFormat('nl-NL');
const euro = (n: number) => `€${Number(n).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type HistoryRow = { page_slug: string; dag: string; position: number; total: number };
type TermRow = { term: string; impressions: number; views: number; conversions: number; reservations: number };
type DemandRow = { query: string; searches: number };
type PriceRow = { dish: string; my_price: number; city_avg: number; restaurants: number };

function useOwnerRpc<T>(name: string, args: Record<string, unknown>, restaurantId: string) {
  return useQuery({
    queryKey: ['owner-pro-insight', name, restaurantId],
    queryFn: async () => {
      const { data, error } = await rpc(name, args);
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

const Empty = ({ children }: { children: string }) => <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;

/** Owner Pro growth insights: position over time, funnel per term, missed demand and price versus the city. */
export function ProGrowthInsights({ restaurantId }: { restaurantId: string }) {
  const history = useOwnerRpc<HistoryRow>('owner_position_history', { p_restaurant_id: restaurantId, p_days: 90 }, restaurantId);
  const terms = useOwnerRpc<TermRow>('owner_term_funnel', { p_restaurant_id: restaurantId, p_days: 30 }, restaurantId);
  const demand = useOwnerRpc<DemandRow>('owner_missed_demand', { p_restaurant_id: restaurantId, p_days: 30 }, restaurantId);
  const prices = useOwnerRpc<PriceRow>('owner_price_benchmark', { p_restaurant_id: restaurantId }, restaurantId);

  const pages = useMemo(() => [...new Set((history.data ?? []).map(r => r.page_slug))], [history.data]);
  const [page, setPage] = useState('');
  const activePage = page || pages[0] || '';
  const series = (history.data ?? []).filter(r => r.page_slug === activePage)
    .map(r => ({ dag: new Date(r.dag).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }), positie: r.position, total: r.total }));
  const first = series[0]?.positie;
  const last = series[series.length - 1]?.positie;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Je positie door de tijd</CardTitle>
          <CardDescription>
            Plek op je gerechtpagina's, elke nacht bijgewerkt.
            {first && last && first !== last ? ` Van #${first} naar #${last} in deze periode.` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? <Empty>Nog geen geschiedenis. Vanaf morgen zie je hier elke dag je positie.</Empty> : (
            <div className="space-y-4">
              {pages.length > 1 && (
                <Select value={activePage} onValueChange={setPage}>
                  <SelectTrigger className="min-h-11 max-w-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{pages.map(p => <SelectItem key={p} value={p}>/{p}</SelectItem>)}</SelectContent>
                </Select>
              )}
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="dag" tick={{ fontSize: 11 }} />
                    <YAxis reversed allowDecimals={false} domain={[1, 'dataMax']} tick={{ fontSize: 11 }} tickFormatter={v => `#${v}`} width={36} />
                    <Tooltip formatter={(v: number, _n, item: any) => [`#${v} van ${item.payload.total}`, 'Positie']} />
                    <Line type="monotone" dataKey="positie" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Welke zoekterm levert gasten op</CardTitle>
          <CardDescription>Per zoekterm of gerechtpagina: hoe vaak je in beeld was, bekeken werd en een gast doorklikte, laatste 30 dagen.</CardDescription>
        </CardHeader>
        <CardContent>
          {!terms.data?.length ? <Empty>Nog geen zoektermen deze maand.</Empty> : (
            <Table>
              <TableHeader><TableRow><TableHead>Zoekterm</TableHead><TableHead className="text-right">In beeld</TableHead><TableHead className="text-right">Bekeken</TableHead><TableHead className="text-right">Doorgeklikt</TableHead><TableHead className="text-right">Reserveringen</TableHead></TableRow></TableHeader>
              <TableBody>
                {terms.data.map(t => (
                  <TableRow key={t.term}>
                    <TableCell className="font-medium">{t.term}</TableCell>
                    <TableCell className="text-right tabular-nums">{nf.format(t.impressions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{nf.format(t.views)}</TableCell>
                    <TableCell className="text-right tabular-nums">{nf.format(t.conversions)}</TableCell>
                    <TableCell className="text-right tabular-nums">{nf.format(t.reservations)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vraag die je misloopt</CardTitle>
          <CardDescription>Gerechten waar in je stad op gezocht werd, maar die niet op je menu staan.</CardDescription>
        </CardHeader>
        <CardContent>
          {!demand.data?.length ? <Empty>Geen gemiste zoekvraag gevonden.</Empty> : (
            <ul className="space-y-2">
              {demand.data.map(d => (
                <li key={d.query} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <span className="font-medium capitalize">{d.query}</span>
                  <span className="tabular-nums text-muted-foreground">{nf.format(d.searches)} zoekopdrachten</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Jouw prijs en de stad</CardTitle>
          <CardDescription>Je prijs per gerecht naast het gemiddelde bij minstens 3 andere restaurants in je stad.</CardDescription>
        </CardHeader>
        <CardContent>
          {!prices.data?.length ? <Empty>Nog te weinig prijzen om te vergelijken.</Empty> : (
            <Table>
              <TableHeader><TableRow><TableHead>Gerecht</TableHead><TableHead className="text-right">Jij</TableHead><TableHead className="text-right">Stad</TableHead></TableRow></TableHeader>
              <TableBody>
                {prices.data.map(p => {
                  const diff = Number(p.my_price) - Number(p.city_avg);
                  return (
                    <TableRow key={p.dish}>
                      <TableCell className="font-medium">{p.dish}</TableCell>
                      <TableCell className="text-right tabular-nums">{euro(p.my_price)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {euro(p.city_avg)}
                        <span className={`ml-1 text-xs ${diff > 0 ? 'text-destructive' : 'text-primary'}`}>({diff > 0 ? '+' : ''}{euro(diff)})</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
