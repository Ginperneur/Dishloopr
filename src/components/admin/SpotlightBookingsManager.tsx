import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type Booking = { id: string; week_start: string; status: string; headline: string; body: string; amount_cents: number;
  restaurant: { name: string; slug: string } | null; city: { name: string } | null };
const db = supabase as unknown as { from: (t: string) => any };

/** Stadsspotlight bookings from this week on, per week and city. Admins can pull an unsuitable text. */
export function SpotlightBookingsManager() {
  const qc = useQueryClient();
  const monday = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-spotlight', monday],
    queryFn: async () => {
      const { data, error } = await db.from('spotlight_bookings').select('*, restaurant:restaurant_id(name, slug), city:city_id(name)')
        .gte('week_start', monday).in('status', ['active', 'pending_payment']).order('week_start').order('city_id').limit(500);
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
  });
  const cancel = async (b: Booking) => {
    const { error } = await db.from('spotlight_bookings').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', b.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Geannuleerd. Betaald? Stort het bedrag terug in Stripe.');
    qc.invalidateQueries({ queryKey: ['admin-spotlight'] });
  };
  const weeks = [...new Set(data.map(b => b.week_start))];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Stadsspotlight</CardTitle>
        <CardDescription>3 plekken per stad per week op de homepage en stadspagina, €39 per week. Hieronder de boekingen vanaf deze week.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? <p className="text-sm text-muted-foreground">Laden…</p> : !data.length ? <p className="text-sm text-muted-foreground">Nog geen boekingen.</p> : weeks.map(w => (
          <div key={w} className="space-y-2">
            <h3 className="text-sm font-semibold">Week van {new Date(`${w}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}</h3>
            {data.filter(b => b.week_start === w).map(b => (
              <div key={b.id} className="flex flex-wrap items-start gap-3 rounded-lg border p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{b.restaurant?.name} <span className="text-muted-foreground">· {b.city?.name}</span></p>
                  <p><strong>{b.headline}</strong> {b.body}</p>
                </div>
                <Badge variant={b.status === 'active' ? 'default' : 'outline'}>{b.status === 'active' ? 'Betaald' : 'Wacht op betaling'}</Badge>
                <Button size="sm" variant="outline" onClick={() => cancel(b)}>Annuleer</Button>
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
