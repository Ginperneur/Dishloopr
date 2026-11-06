import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { OWNER_PRO_PRICES } from '@/lib/proPricing';

// package_orders is not in the generated types yet (migration 20261106160000).
const db = supabase as any;

interface PackageOrder {
  id: string;
  package: 'founding_partner' | 'menu_service';
  plan: 'month' | 'year' | 'once';
  page_slug: string | null;
  status: string;
  fulfillment_status: string;
  amount_cents: number;
  commitment_until: string | null;
  created_at: string;
  restaurant: { name: string; slug: string } | null;
}

const LIVE = ['active', 'trialing', 'past_due'];
const euro = (n: number) => `€${n.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}`;

/** Monthly recurring value of an order; yearly plans count as a twelfth. */
function monthlyValue(o: Pick<PackageOrder, 'plan' | 'amount_cents'>) {
  if (o.plan === 'once') return 0;
  return o.plan === 'year' ? o.amount_cents / 100 / 12 : o.amount_cents / 100;
}

/**
 * Every paid product in one place: monthly recurring revenue per product, plus
 * the Founding Partner and Menuservice orders. Menuservice is delivered by hand,
 * so open orders stay on top until they are marked done.
 */
export function PackageOrdersManager() {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-package-orders'],
    queryFn: async () => {
      const [orders, pro, events, tags] = await Promise.all([
        db.from('package_orders').select('*, restaurant:restaurant_id(name, slug)').order('created_at', { ascending: false }).limit(500),
        supabase.from('owner_pro_subscriptions').select('billing_interval').eq('status', 'active'),
        supabase.from('restaurant_events').select('id', { count: 'exact', head: true }).eq('promotion_status', 'paid'),
        supabase.from('restaurant_tag_subscriptions').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      if (orders.error) throw orders.error;
      return {
        orders: (orders.data ?? []) as PackageOrder[],
        proMonthly: (pro.data ?? []).filter(p => p.billing_interval !== 'yearly').length,
        proYearly: (pro.data ?? []).filter(p => p.billing_interval === 'yearly').length,
        paidEvents: events.count ?? 0,
        paidTags: tags.count ?? 0,
      };
    },
  });

  const setFulfillment = async (id: string, fulfillment_status: 'todo' | 'done') => {
    setBusyId(id);
    const { error } = await db.from('package_orders').update({ fulfillment_status, updated_at: new Date().toISOString() }).eq('id', id);
    setBusyId(null);
    if (error) { toast.error('Kon status niet aanpassen', { description: error.message }); return; }
    queryClient.invalidateQueries({ queryKey: ['admin-package-orders'] });
  };

  if (isLoading || !data) {
    return <Card><CardContent className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  const live = data.orders.filter(o => LIVE.includes(o.status));
  const founding = live.filter(o => o.package === 'founding_partner');
  const menu = live.filter(o => o.package === 'menu_service');
  const foundingBilling = founding.filter(o => o.status !== 'trialing');
  const rows = [
    { label: 'Owner Pro', count: data.proMonthly + data.proYearly, mrr: data.proMonthly * OWNER_PRO_PRICES.monthly.amount + data.proYearly * OWNER_PRO_PRICES.yearly.amount / 12 },
    { label: 'Founding Partner (betalend)', count: foundingBilling.length, mrr: foundingBilling.reduce((s, o) => s + monthlyValue(o), 0) },
    { label: 'Founding Partner (start bij launch)', count: founding.length - foundingBilling.length, mrr: founding.filter(o => o.status === 'trialing').reduce((s, o) => s + monthlyValue(o), 0), pending: true },
    { label: 'Menuservice per maand', count: menu.filter(o => o.plan === 'month').length, mrr: menu.reduce((s, o) => s + monthlyValue(o), 0) },
    { label: 'Evenementen', count: data.paidEvents, mrr: data.paidEvents * 5 },
  ];
  const mrr = rows.filter(r => !r.pending).reduce((s, r) => s + r.mrr, 0);
  const openMenu = data.orders.filter(o => o.package === 'menu_service' && o.fulfillment_status === 'todo');
  const oneOff = data.orders.filter(o => o.plan === 'once').reduce((s, o) => s + o.amount_cents / 100, 0);
  const sorted = [...openMenu, ...data.orders.filter(o => !openMenu.includes(o))];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{euro(mrr)}</p><p className="text-xs text-muted-foreground">Terugkerende omzet per maand (excl. btw)</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-2xl font-bold">{euro(rows[2].mrr)}</p><p className="text-xs text-muted-foreground">Extra per maand zodra de launch-trials betalen</p></CardContent></Card>
        <Card className={openMenu.length ? 'border-primary' : undefined}><CardContent className="pt-6"><p className="text-2xl font-bold">{openMenu.length}</p><p className="text-xs text-muted-foreground">Menuservice nog te leveren (binnen 3 werkdagen)</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Omzet per product</CardTitle>
          <CardDescription>Jaarplannen tellen als een twaalfde per maand. Extra tags: {data.paidTags} actief (prijs staat in Stripe). Eenmalig ontvangen voor Menuservice: {euro(oneOff)}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Actief</TableHead><TableHead className="text-right">Per maand</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.label}>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.pending ? <span className="text-muted-foreground">{euro(r.mrr)} vanaf launch</span> : euro(r.mrr)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Founding Partner en Menuservice</CardTitle>
          <CardDescription>Bestellingen komen binnen via Stripe. Max. 5 Founding Partners per gerechtpagina.</CardDescription>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nog geen bestellingen.</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Restaurant</TableHead><TableHead>Pakket</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actie</TableHead></TableRow></TableHeader>
              <TableBody>
                {sorted.map(o => (
                  <TableRow key={o.id}>
                    <TableCell>
                      {o.restaurant ? <Link className="underline" to={`/restaurant/${o.restaurant.slug}`}>{o.restaurant.name}</Link> : 'Onbekend'}
                      <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString('nl-NL')}</div>
                    </TableCell>
                    <TableCell>
                      {o.package === 'founding_partner' ? 'Founding Partner' : 'Menuservice'} · {o.plan === 'once' ? 'eenmalig' : o.plan === 'year' ? 'per jaar' : 'per maand'}
                      {o.page_slug && <div className="text-xs text-muted-foreground">/{o.page_slug}</div>}
                      {o.commitment_until && <div className="text-xs text-muted-foreground">Vast tot {new Date(o.commitment_until).toLocaleDateString('nl-NL')}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={LIVE.includes(o.status) ? 'default' : 'secondary'}>{o.status === 'trialing' ? 'start bij launch' : o.status}</Badge>
                      {o.package === 'menu_service' && <div className="mt-1 text-xs">{o.fulfillment_status === 'done' ? 'Geleverd' : 'Nog leveren'}</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      {o.package === 'menu_service' && (
                        <Button size="sm" variant={o.fulfillment_status === 'done' ? 'outline' : 'default'} disabled={busyId === o.id}
                          onClick={() => setFulfillment(o.id, o.fulfillment_status === 'done' ? 'todo' : 'done')}>
                          {o.fulfillment_status === 'done' ? 'Terugzetten' : 'Geleverd'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
