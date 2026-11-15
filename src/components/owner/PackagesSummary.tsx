import { useQuery } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// package_orders is newer than the generated types.
const db = supabase as unknown as SupabaseClient;

interface Line { key: string; title: string; detail: string; status: 'actief' | 'start' | 'mislukt' }

const date = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' }) : null);

/** Everything the owner pays for, in one list: Uitgelicht, menu service, Owner Pro and extra tags. */
export function PackagesSummary({ restaurantId, isPro, onManage, onExplore }: {
  restaurantId: string;
  isPro: boolean;
  onManage?: () => void;
  onExplore: () => void;
}) {
  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['owner-packages-summary', restaurantId, isPro],
    queryFn: async (): Promise<Line[]> => {
      const [orders, tags] = await Promise.all([
        db.from('package_orders').select('id, package, plan, page_slug, status, current_period_end').eq('restaurant_id', restaurantId),
        supabase.from('restaurant_tag_subscriptions').select('id, tag_value, payment_type').eq('restaurant_id', restaurantId).eq('is_active', true),
      ]);
      const out: Line[] = [];
      for (const o of (orders.data ?? []) as { id: string; package: string; plan: string; page_slug: string | null; status: string; current_period_end: string | null }[]) {
        if (!['active', 'trialing', 'past_due'].includes(o.status) && o.plan !== 'once') continue;
        const renew = date(o.current_period_end);
        out.push({
          key: o.id,
          title: o.package === 'menu_service' ? 'Menuservice' : `Uitgelicht${o.page_slug ? ` op /${o.page_slug}` : ''}`,
          detail: o.plan === 'once' ? 'Eenmalig' : `${o.plan === 'year' ? 'Jaarabonnement' : 'Maandabonnement'}${renew ? `, verlengt ${renew}` : ''}`,
          status: o.status === 'past_due' ? 'mislukt' : o.status === 'trialing' ? 'start' : 'actief',
        });
      }
      if (isPro) out.push({ key: 'pro', title: 'Owner Pro', detail: 'Inzichten, Markt en alle Pro-functies', status: 'actief' });
      for (const t of (tags.data ?? []) as { id: string; tag_value: string; payment_type: string }[]) {
        out.push({ key: t.id, title: `Tag: ${t.tag_value}`, detail: t.payment_type === 'owner_pro' ? 'Extra tag, inbegrepen bij Owner Pro' : 'Extra tag, €5 per maand', status: 'actief' });
      }
      return out;
    },
  });

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Package className="h-4 w-4 text-primary" />Mijn pakketten</CardTitle>
        {onManage && lines.length > 0 && <Button variant="link" size="sm" className="h-auto p-0" onClick={onManage}>Beheren</Button>}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-muted" />
        ) : lines.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Je hebt nog geen betaald pakket. Met Uitgelicht sta je bovenaan bij je gerechten.</p>
            <Button size="sm" onClick={onExplore}>Bekijk Uitgelicht</Button>
          </div>
        ) : (
          lines.map(l => (
            <div key={l.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{l.title}</p>
                <p className="text-xs text-muted-foreground">{l.detail}</p>
              </div>
              <Badge variant={l.status === 'mislukt' ? 'destructive' : 'secondary'} className="shrink-0">
                {l.status === 'mislukt' ? 'Betaling mislukt' : l.status === 'start' ? 'Start bij de launch' : 'Actief'}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
