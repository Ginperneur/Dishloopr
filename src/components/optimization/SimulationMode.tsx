import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Loader2, Search, Wand2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { simulationSummary, type SimulationQuota, type SimulationResult } from '@/lib/simulation';

// run_owner_simulation and friends are newer than the generated types.
const db = supabase as unknown as SupabaseClient;

type Kind = 'add_dish' | 'change_price' | 'remove_tag';

interface Props {
  restaurantId: string;
  /** The restaurant's own tags, for "tag verwijderen". */
  tags?: string[];
  priceLevel?: number | null;
  /** Kept for older callers; the quota now comes from the database. */
  isPremium?: boolean;
  /** Kept for older callers; simulations now run in the database. */
  onSimulate?: unknown;
}

const PRICE_LABEL: Record<number, string> = { 1: '€', 2: '€€', 3: '€€€', 4: '€€€€' };

/** "What if" on real search data: 3 free per restaurant, then 1.99 euro each; Owner Pro unlimited. */
export function SimulationMode({ restaurantId, tags = [], priceLevel = null }: Props) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>('add_dish');
  const [dishQuery, setDishQuery] = useState('');
  const [dishId, setDishId] = useState('');
  const [tag, setTag] = useState('');
  const [price, setPrice] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [buying, setBuying] = useState(false);
  const [qty, setQty] = useState(1);

  const { data: quota } = useQuery({
    queryKey: ['simulation-quota', restaurantId],
    queryFn: async () => {
      const { data, error } = await db.rpc('owner_simulation_quota', { p_restaurant: restaurantId });
      if (error) throw error;
      return data as SimulationQuota;
    },
  });

  const { data: dishes = [] } = useQuery({
    queryKey: ['simulation-dishes', restaurantId],
    queryFn: async () => {
      const [{ data: own }, { data: all }] = await Promise.all([
        supabase.from('restaurant_dishes').select('dish_id').eq('restaurant_id', restaurantId),
        supabase.from('dishes').select('id, name, slug, canonical_slug, search_count').eq('is_active', true)
          .order('search_count', { ascending: false }).limit(300),
      ]);
      const mine = new Set((own ?? []).map(r => r.dish_id));
      // Only main dishes (the ones with a dish page), not menu variants.
      return (all ?? []).filter(d => !mine.has(d.id) && (!d.canonical_slug || d.canonical_slug === d.slug));
    },
  });
  const shownDishes = useMemo(() => {
    const q = dishQuery.trim().toLowerCase();
    return (q ? dishes.filter(d => d.name.toLowerCase().includes(q)) : dishes).slice(0, 12);
  }, [dishes, dishQuery]);

  useEffect(() => { setResult(null); }, [kind]);

  const canRun = quota && (quota.unlimited || quota.free_left > 0 || quota.credits > 0);
  const ready = kind === 'add_dish' ? !!dishId : kind === 'change_price' ? !!price : !!tag;

  const run = async () => {
    setRunning(true);
    const { data, error } = await db.rpc('run_owner_simulation', {
      p_restaurant: restaurantId, p_kind: kind,
      p_dish: kind === 'add_dish' ? dishId : null,
      p_tag: kind === 'remove_tag' ? tag : null,
      p_price_level: kind === 'change_price' ? Number(price) : null,
    });
    setRunning(false);
    if (error) {
      toast.error(error.message);
      qc.invalidateQueries({ queryKey: ['simulation-quota', restaurantId] });
      return;
    }
    setResult(data as SimulationResult);
    qc.setQueryData(['simulation-quota', restaurantId], (data as SimulationResult).quota);
  };

  const buy = async () => {
    setBuying(true);
    const { data, error } = await supabase.functions.invoke('create-simulation-checkout', { body: { restaurant_id: restaurantId, quantity: qty } });
    if (error || !data?.url) {
      const reason = data?.error ?? await (error as { context?: Response } | null)?.context?.json?.().then((b: { error?: string }) => b?.error).catch(() => null);
      toast.error(reason || 'Afrekenen lukte niet. Probeer het opnieuw.');
      setBuying(false);
      return;
    }
    window.location.href = data.url;
  };

  const summary = result ? simulationSummary(result, priceLevel) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Wand2 className="h-5 w-5 text-primary" />Wat als?
          {quota && (
            <Badge variant="secondary" className="ml-auto">
              {quota.unlimited ? 'Onbeperkt met Owner Pro'
                : quota.free_left > 0 ? `${quota.free_left} gratis over`
                : quota.credits > 0 ? `${quota.credits} ${quota.credits === 1 ? 'simulatie' : 'simulaties'} tegoed`
                : 'Gratis simulaties op'}
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Zie vooraf wat een wijziging oplevert, op basis van echte zoekopdrachten in jouw stad. De eerste 3 zijn gratis, daarna €1,99 per simulatie.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <Select value={kind} onValueChange={v => setKind(v as Kind)}>
          <SelectTrigger className="min-h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="add_dish">Gerecht toevoegen aan mijn menu</SelectItem>
            <SelectItem value="change_price">Andere prijsklasse</SelectItem>
            <SelectItem value="remove_tag">Tag verwijderen</SelectItem>
          </SelectContent>
        </Select>

        {kind === 'add_dish' && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={dishQuery} onChange={e => setDishQuery(e.target.value)} placeholder="Zoek een gerecht" className="min-h-11 pl-9" />
            </div>
            <div className="flex flex-wrap gap-2">
              {shownDishes.map(d => (
                <Button key={d.id} type="button" size="sm" variant={dishId === d.id ? 'default' : 'outline'} onClick={() => setDishId(d.id)}>{d.name}</Button>
              ))}
            </div>
          </div>
        )}
        {kind === 'change_price' && (
          <Select value={price} onValueChange={setPrice}>
            <SelectTrigger className="min-h-11"><SelectValue placeholder={`Nu: ${priceLevel ? PRICE_LABEL[priceLevel] : 'onbekend'}. Kies de nieuwe prijsklasse`} /></SelectTrigger>
            <SelectContent>{[1, 2, 3, 4].filter(l => l !== priceLevel).map(l => <SelectItem key={l} value={String(l)}>{PRICE_LABEL[l]}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {kind === 'remove_tag' && (
          tags.length ? (
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger className="min-h-11"><SelectValue placeholder="Kies een van je tags" /></SelectTrigger>
              <SelectContent>{tags.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          ) : <p className="text-sm text-muted-foreground">Je restaurant heeft nog geen tags.</p>
        )}

        {canRun ? (
          <Button onClick={run} disabled={!ready || running} className="min-h-11">
            {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simuleer
          </Button>
        ) : quota ? (
          <div className="space-y-3 rounded-lg border p-4">
            <p className="text-sm">Je 3 gratis simulaties zijn gebruikt. Een simulatie kost €1,99; met Owner Pro simuleer je onbeperkt.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(qty)} onValueChange={v => setQty(Number(v))}>
                <SelectTrigger className="min-h-11 w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 3, 5, 10].map(n => <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'simulatie' : 'simulaties'}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={buy} disabled={buying} className="min-h-11">
                {buying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                Koop voor €{(1.99 * qty).toFixed(2).replace('.', ',')}
              </Button>
            </div>
          </div>
        ) : null}

        {summary && (
          <div className="space-y-2 rounded-lg bg-muted/50 p-4" role="status">
            <p className="font-semibold">{summary.headline}</p>
            {summary.lines.map(l => <p key={l} className="text-sm text-muted-foreground">{l}</p>)}
            <p className="text-xs text-muted-foreground">{summary.confidence}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
