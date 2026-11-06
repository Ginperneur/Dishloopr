import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Flag, MousePointer, UtensilsCrossed } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// package_orders and owner_founding_stats are not in the generated types yet.
const db = supabase as any;

interface Order {
  id: string;
  package: 'founding_partner' | 'menu_service';
  plan: 'month' | 'year' | 'once';
  page_slug: string | null;
  status: string;
  fulfillment_status: string;
  commitment_until: string | null;
  current_period_end: string | null;
}

const nf = new Intl.NumberFormat('nl-NL');
const date = (v: string | null) => (v ? new Date(v).toLocaleDateString('nl-NL') : null);

/**
 * The owner's Founding Partner places and Menuservice orders, with what the
 * "Uitgelicht" block delivered in the last 30 days. Without a package it shows
 * what Founding Partner costs and saves, linking to the packages page.
 */
export function MyPackagesCard({ restaurantId, restaurantSlug }: { restaurantId: string; restaurantSlug: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Opt-out for send-monthly-founding-report (owner_email_preferences.founding_report).
  const { data: reportOn = true } = useQuery({
    queryKey: ['founding-report-pref', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data } = await db.from('owner_email_preferences').select('founding_report').eq('user_id', user!.id).maybeSingle();
      return (data?.founding_report as boolean | undefined) ?? true;
    },
  });
  const setReport = async (next: boolean) => {
    if (!user) return;
    queryClient.setQueryData(['founding-report-pref', user.id], next);
    const { error } = await db.from('owner_email_preferences').upsert({ user_id: user.id, founding_report: next }, { onConflict: 'user_id' });
    if (error) {
      toast.error('Kon voorkeur niet opslaan');
      queryClient.setQueryData(['founding-report-pref', user.id], !next);
    } else {
      toast.success(next ? 'Maandrapport Founding Partner ingeschakeld' : 'Maandrapport Founding Partner uitgeschakeld');
    }
  };

  const { data } = useQuery({
    queryKey: ['owner-packages', restaurantId],
    queryFn: async () => {
      const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      const [orders, stats] = await Promise.all([
        db.from('package_orders').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }),
        db.rpc('owner_founding_stats', { p_restaurant_id: restaurantId, p_from: from }),
      ]);
      const perPage = new Map<string, { impressie: number; klik: number }>();
      for (const r of (stats.data ?? []) as { page_slug: string; metric: 'impressie' | 'klik'; totaal: number }[]) {
        const s = perPage.get(r.page_slug) ?? { impressie: 0, klik: 0 };
        s[r.metric] += Number(r.totaal);
        perPage.set(r.page_slug, s);
      }
      return { orders: (orders.data ?? []) as Order[], perPage };
    },
  });

  const live = (data?.orders ?? []).filter(o => ['active', 'trialing', 'past_due'].includes(o.status) || o.plan === 'once');
  const packagesUrl = `/voor-restaurants/pakketten?slug=${encodeURIComponent(restaurantSlug)}`;

  if (!live.length) {
    return (
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Flag className="h-5 w-5 text-primary" />Founding Partner</CardTitle>
          <CardDescription>
            Sta gegarandeerd bovenaan je gerechtpagina in het blok "Uitgelicht". Normaal €99 per maand, als Founding Partner €59:
            je bespaart €480 per jaar, of €598 met het jaarabonnement. Max. 5 plekken per gerechtpagina.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="min-h-11"><Link to={packagesUrl}>Bekijk de pakketten</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Flag className="h-5 w-5 text-primary" />Jouw pakketten</CardTitle>
        <CardDescription>Cijfers over de afgelopen 30 dagen. Elke maand krijg je ze ook per mail.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {live.map(o => {
          if (o.package === 'menu_service') {
            return (
              <div key={o.id} className="flex items-start gap-3 rounded-lg border p-4">
                <UtensilsCrossed className="mt-0.5 h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">Menuservice {o.plan === 'once' ? '(eenmalig)' : '(per maand)'}</p>
                  <p className="text-sm text-muted-foreground">
                    {o.fulfillment_status === 'done' ? 'Je menukaart staat online.' : 'We zetten je menukaart binnen 3 werkdagen online, vertaald, als QR-code en widget.'}
                  </p>
                </div>
              </div>
            );
          }
          const s = data?.perPage.get(o.page_slug ?? '') ?? { impressie: 0, klik: 0 };
          return (
            <div key={o.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">Uitgelicht op <Link className="text-primary underline" to={`/eten/${o.page_slug}`}>/{o.page_slug}</Link></p>
                <Badge variant={o.status === 'past_due' ? 'destructive' : 'default'}>
                  {o.status === 'trialing' ? 'Start bij de launch' : o.status === 'past_due' ? 'Betaling mislukt' : 'Actief'}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-md bg-muted/50 p-3"><Eye className="h-4 w-4 text-muted-foreground" /><p className="mt-1 text-xl font-bold tabular-nums">{nf.format(s.impressie)}</p><p className="text-xs text-muted-foreground">keer in beeld</p></div>
                <div className="rounded-md bg-muted/50 p-3"><MousePointer className="h-4 w-4 text-muted-foreground" /><p className="mt-1 text-xl font-bold tabular-nums">{nf.format(s.klik)}</p><p className="text-xs text-muted-foreground">keer aangeklikt</p></div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {o.plan === 'year' ? '€590 per jaar' : '€59 per maand'}, vaste prijs zolang je klant blijft.
                {o.commitment_until && ` Minimale looptijd tot ${date(o.commitment_until)}.`}
              </p>
            </div>
          );
        })}
        {live.some(o => o.package === 'founding_partner') && (
          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <div>
              <p className="text-sm font-medium">Maandrapport Founding Partner</p>
              <p className="text-xs text-muted-foreground">Op de 1e van de maand: hoe vaak je in het blok Uitgelicht in beeld was en werd aangeklikt.</p>
            </div>
            <Switch checked={reportOn} onCheckedChange={setReport} disabled={!user} aria-label="Maandrapport Founding Partner" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
