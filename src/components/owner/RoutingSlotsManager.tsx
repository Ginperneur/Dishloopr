import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Gavel, Loader2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatEuroCents, routingAction, type MarketStatus } from '@/lib/promoSlots';

// promo_* tables and functions are newer than the generated types.
const db = supabase as unknown as SupabaseClient;

interface Props { restaurantId: string; cityId: string | null }

/** Vraag doorsturen: buy a monthly slot per dish per city, or bid when all slots are taken. */
export function RoutingSlotsManager({ restaurantId, cityId }: Props) {
  const qc = useQueryClient();
  const [city, setCity] = useState<string>(cityId ?? '');
  const [dish, setDish] = useState<string>('');
  const [bid, setBid] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (cityId && !city) setCity(cityId); }, [cityId, city]);

  const { data: cities = [] } = useQuery({
    queryKey: ['nl-cities'],
    queryFn: async () => (await supabase.from('cities').select('id, name').eq('is_active', true).eq('country_code', 'NL').order('name')).data ?? [],
  });
  const { data: dishes = [] } = useQuery({
    queryKey: ['own-menu-dishes', restaurantId],
    queryFn: async () => {
      const { data } = await supabase.from('restaurant_dishes').select('dish:dishes(id, name)')
        .eq('restaurant_id', restaurantId).in('status', ['verified_by_owner', 'approved_by_admin']);
      const list = (data ?? []).map(r => r.dish as { id: string; name: string } | null).filter((d): d is { id: string; name: string } => !!d?.name);
      return [...new Map(list.map(d => [d.id, d])).values()].sort((a, b) => a.name.localeCompare(b.name, 'nl'));
    },
  });
  const { data: status, isFetching } = useQuery({
    queryKey: ['promo-status', restaurantId, city, dish],
    enabled: !!city && !!dish,
    queryFn: async () => {
      const { data, error } = await db.rpc('promo_market_status', { p_product: 'routing', p_city: city, p_dish: dish, p_restaurant: restaurantId });
      if (error) throw error;
      return data as MarketStatus;
    },
  });
  const { data: mine = [] } = useQuery({
    queryKey: ['promo-mine', restaurantId],
    queryFn: async () => {
      const [slots, bids] = await Promise.all([
        db.from('promo_slots').select('id, status, price_cents, term_end, market:promo_markets(product, city:cities(name), dish:dishes(name))')
          .eq('restaurant_id', restaurantId).in('status', ['active', 'ending']),
        db.from('promo_bids').select('id, status, amount_cents, clearing_cents, pay_by, market:promo_markets(product, city:cities(name), dish:dishes(name))')
          .eq('restaurant_id', restaurantId).in('status', ['open', 'won']),
      ]);
      type M = { product: string; city: { name: string } | null; dish: { name: string } | null };
      return [
        ...((slots.data ?? []) as unknown as { id: string; status: string; price_cents: number; term_end: string | null; market: M }[])
          .map(s => ({ key: s.id, kind: 'slot' as const, label: `${s.market?.dish?.name} in ${s.market?.city?.name}`, status: s.status, cents: s.price_cents, until: s.term_end })),
        ...((bids.data ?? []) as unknown as { id: string; status: string; amount_cents: number; clearing_cents: number | null; pay_by: string | null; market: M }[])
          .map(b => ({ key: b.id, kind: 'bid' as const, label: `${b.market?.dish?.name} in ${b.market?.city?.name}`, status: b.status, cents: b.status === 'won' ? b.clearing_cents ?? b.amount_cents : b.amount_cents, until: b.pay_by })),
      ];
    },
  });
  const total = useMemo(() => mine.filter(m => m.kind === 'slot' && m.status === 'active').reduce((s, m) => s + m.cents, 0), [mine]);
  const action = status ? routingAction(status) : null;
  const refresh = () => { qc.invalidateQueries({ queryKey: ['promo-status'] }); qc.invalidateQueries({ queryKey: ['promo-mine', restaurantId] }); };

  const checkout = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('create-promo-checkout', {
      body: { product: 'routing', city_id: city, dish_id: dish, restaurant_id: restaurantId },
    });
    if (error || !data?.url) {
      const reason = data?.error ?? await (error as { context?: Response } | null)?.context?.json?.().then((b: { error?: string }) => b?.error).catch(() => null);
      toast.error(reason || 'Afrekenen lukte niet. Probeer het opnieuw.');
      setBusy(false);
      refresh();
      return;
    }
    window.location.href = data.url;
  };
  const placeBid = async () => {
    const cents = Math.round(Number(bid.replace(',', '.')) * 100);
    if (!Number.isFinite(cents) || cents <= 0) { toast.error('Vul een bedrag in euro in.'); return; }
    setBusy(true);
    const { error } = await db.rpc('place_promo_bid', { p_product: 'routing', p_city: city, p_dish: dish, p_restaurant: restaurantId, p_amount_cents: cents });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Bod geplaatst. Je hoort het als er een plek vrijkomt of na de volgende veiling.');
    setBid('');
    refresh();
  };
  const withdraw = async (bidId: string) => {
    const { error } = await db.rpc('withdraw_promo_bid', { p_bid: bidId });
    if (error) { toast.error(error.message); return; }
    toast.success('Bod ingetrokken');
    refresh();
  };
  const manage = async () => {
    const { data, error } = await supabase.functions.invoke('owner-pro-portal');
    if (error || !data?.url) { toast.error('Kon het betaaloverzicht niet openen.'); return; }
    window.location.href = data.url;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Zap className="h-5 w-5 text-primary" />Vraag doorsturen</CardTitle>
        <CardDescription>
          Is een restaurant gesloten of vol, dan sturen we gasten door naar een alternatief met hetzelfde gerecht in dezelfde stad.
          Met een plek sta je daar bovenaan, als gesponsord. Per gerecht per stad zijn er 3 plekken.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Stad</Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="min-h-11"><SelectValue placeholder="Kies een stad" /></SelectTrigger>
              <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Gerecht van je menu</Label>
            <Select value={dish} onValueChange={setDish} disabled={!dishes.length}>
              <SelectTrigger className="min-h-11"><SelectValue placeholder={dishes.length ? 'Kies een gerecht' : 'Voeg eerst gerechten toe onder Menu'} /></SelectTrigger>
              <SelectContent>{dishes.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {city && dish && (
          <div className="rounded-lg border p-4 space-y-3">
            {isFetching && !status ? (
              <div className="h-16 animate-pulse rounded bg-muted" />
            ) : status && action ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-2xl font-bold">{formatEuroCents(status.list_price_cents)} <span className="text-sm font-normal text-muted-foreground">per maand</span></p>
                  <Badge variant={status.taken >= status.slots ? 'destructive' : 'secondary'}>
                    {status.taken >= status.slots ? 'Alle plekken bezet' : `${status.slots - status.taken} van ${status.slots} plekken vrij`}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Prijs op basis van vraag: {status.searches_per_month ?? 0} zoekopdrachten per maand en {status.suppliers ?? 0} restaurants met dit gerecht in deze stad.
                  {status.open_bids > 0 && ` ${status.open_bids} ${status.open_bids === 1 ? 'bod' : 'biedingen'} op de wachtlijst, hoogste ${formatEuroCents(status.highest_bid_cents ?? 0)}.`}
                  {' '}Volgende veiling: {new Date(status.next_auction).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}.
                </p>
                {action.kind === 'active' && <p className="text-sm font-medium text-emerald-700">{action.text}</p>}
                {action.kind === 'ending' && <p className="text-sm text-muted-foreground">{action.text}</p>}
                {(action.kind === 'buy' || action.kind === 'pay_won') && (
                  <Button onClick={checkout} disabled={busy} className="min-h-11">
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{action.text}
                  </Button>
                )}
                {action.kind === 'bid' && (
                  <div className="space-y-2">
                    <p className="text-sm">{action.text}</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Input inputMode="decimal" placeholder={`Minimaal ${formatEuroCents(status.list_price_cents)}`} value={bid}
                        onChange={e => setBid(e.target.value)} className="min-h-11 sm:max-w-[220px]" aria-label="Je bod per maand in euro" />
                      <Button variant="outline" onClick={placeBid} disabled={busy || !bid} className="min-h-11">
                        <Gavel className="mr-2 h-4 w-4" />{status.my_bid ? 'Bod aanpassen' : 'Bied'}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        <div className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Hoe het werkt</p>
          <p>Een vrije plek koop je direct voor de lijstprijs, per maand opzegbaar. Gerechten en steden met veel vraag zijn duurder.</p>
          <p>Alles bezet? Bied het bedrag dat je maximaal per maand wilt betalen. Komt er een plek vrij, dan gaat die naar het hoogste bod.</p>
          <p>Elk kwartaal is er een veiling. De 3 hoogste houden of krijgen een plek en betalen allemaal hetzelfde: het hoogste bod dat net niet won, minimaal de lijstprijs. Zonder biedingen loopt je plek gewoon door tegen de lijstprijs.</p>
          <p><Link to="/voor-restaurants/plekken-en-bieden" className="font-medium text-primary underline">Lees de volledige uitleg met rekenvoorbeeld</Link></p>
        </div>

        {mine.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Jouw plekken en biedingen</p>
              {total > 0 && <p className="text-sm text-muted-foreground">Totaal {formatEuroCents(total)} per maand</p>}
            </div>
            {mine.map(m => (
              <div key={m.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium capitalize">{m.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.kind === 'slot'
                      ? `${formatEuroCents(m.cents)} per maand${m.status === 'ending' ? ', loopt af aan het eind van je betaalde periode' : m.until ? `, tot de veiling na ${new Date(m.until).toLocaleDateString('nl-NL')}` : ''}`
                      : m.status === 'won' ? `Gewonnen voor ${formatEuroCents(m.cents)} per maand, rond af voor ${m.until ? new Date(m.until).toLocaleDateString('nl-NL') : 'de deadline'}` : `Bod: ${formatEuroCents(m.cents)} per maand`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={m.status === 'won' ? 'default' : 'secondary'}>
                    {m.kind === 'slot' ? (m.status === 'ending' ? 'Loopt af' : 'Actief') : m.status === 'won' ? 'Gewonnen' : 'Op wachtlijst'}
                  </Badge>
                  {m.kind === 'bid' && <Button size="sm" variant="ghost" onClick={() => withdraw(m.key)}>Intrekken</Button>}
                </div>
              </div>
            ))}
            {mine.some(m => m.kind === 'slot') && (
              <Button variant="link" className="h-auto p-0 text-sm" onClick={manage}>Betalingen beheren of opzeggen</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
