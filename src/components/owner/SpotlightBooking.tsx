import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { VatTotal } from '@/components/common/VatTotal';
import { PRICES, euroCents } from '@/lib/paidPricing';

type Week = { week_start: string; places_left: number; mine: boolean };
const weekLabel = (d: string) => {
  const start = new Date(`${d}T12:00:00`);
  const end = new Date(start.getTime() + 6 * 86_400_000);
  const f = (x: Date) => x.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  return `${f(start)} t/m ${f(end)}`;
};

/** Book the Stadsspotlight: 3 places per city per week on the homepage and city page, 39 euro a week. */
export function SpotlightBooking({ restaurantId, cityId }: { restaurantId: string; cityId: string | null }) {
  const [weeks, setWeeks] = useState<string[]>([]);
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: calendar = [], isLoading } = useQuery({
    queryKey: ['spotlight-weeks', cityId, restaurantId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('spotlight_weeks', { p_city: cityId, p_restaurant: restaurantId });
      if (error) throw error;
      return (data ?? []) as Week[];
    },
    enabled: Boolean(cityId),
  });
  if (!cityId) return <p className="text-sm text-muted-foreground">Je restaurant heeft nog geen stad. Vul je adres in onder Profiel.</p>;
  const toggle = (w: string) => setWeeks(ws => (ws.includes(w) ? ws.filter(x => x !== w) : [...ws, w]));
  const total = weeks.length * PRICES.spotlightWeek;
  const book = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-spotlight-checkout', { body: { restaurant_id: restaurantId, weeks, headline, body } });
      const message = data?.error ?? (error ? await error.context?.json?.().then((b: any) => b?.error).catch(() => null) : null);
      if (message || error || !data?.url) throw new Error(message || 'Geen checkout ontvangen');
      window.location.href = data.url;
    } catch (e) {
      toast.error('Boeken lukte niet', { description: e instanceof Error ? e.message : undefined });
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Je staat een week lang op de homepage en de stadspagina, met een eigen kop zoals "Net geopend" of "Nieuw wintermenu". Er zijn 3 plekken per stad per week, voor {euroCents(PRICES.spotlightWeek)} per week excl. btw.</p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Kies je weken</legend>
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <div className="grid gap-2 sm:grid-cols-2">
            {calendar.map(w => (
              <label key={w.week_start} className={`flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm ${w.places_left === 0 && !w.mine ? 'opacity-60' : 'cursor-pointer'}`}>
                <input type="checkbox" disabled={w.mine || w.places_left === 0} checked={w.mine || weeks.includes(w.week_start)} onChange={() => toggle(w.week_start)} />
                <span className="flex-1">{weekLabel(w.week_start)}</span>
                <span className="text-xs text-muted-foreground">{w.mine ? 'geboekt' : w.places_left === 0 ? 'vol' : `nog ${w.places_left}`}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="spot-head">Kop (max. 40 tekens)</Label>
        <Input id="spot-head" maxLength={40} value={headline} onChange={e => setHeadline(e.target.value)} placeholder="Nieuw wintermenu" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="spot-body">Tekst (max. 160 tekens)</Label>
        <Textarea id="spot-body" maxLength={160} rows={2} value={body} onChange={e => setBody(e.target.value)} placeholder="Stoofvlees en een driegangenmenu voor €42." />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{weeks.length} {weeks.length === 1 ? 'week' : 'weken'}: {euroCents(total)} excl. btw</p>
          {total > 0 && <VatTotal exCents={total} className="text-xs" />}
        </div>
        <Button className="min-h-11" disabled={busy || !weeks.length || headline.trim().length < 2 || body.trim().length < 2} onClick={book}>
          {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Boek en betaal
        </Button>
      </div>
    </div>
  );
}
