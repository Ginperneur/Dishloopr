import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CalendarX, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface Exception {
  id: string;
  exception_date: string;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
  reason: string | null;
}

export function OpeningHoursExceptions({ restaurantId }: { restaurantId: string }) {
  const [items, setItems] = useState<Exception[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [isClosed, setIsClosed] = useState(true);
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [reason, setReason] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from('opening_hours_exceptions')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .gte('exception_date', new Date().toISOString().slice(0, 10))
      .order('exception_date');
    setItems((data as Exception[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurantId]);

  const add = async () => {
    if (!date) { toast.error('Kies een datum'); return; }
    const { error } = await (supabase as any)
      .from('opening_hours_exceptions')
      .insert({
        restaurant_id: restaurantId,
        exception_date: date,
        is_closed: isClosed,
        open_time: isClosed ? null : openTime || null,
        close_time: isClosed ? null : closeTime || null,
        reason: reason || null,
      });
    if (error) { toast.error('Kon niet opslaan'); return; }
    toast.success('Uitzondering toegevoegd');
    setDate(''); setReason(''); setOpenTime(''); setCloseTime(''); setIsClosed(true);
    load();
  };

  const remove = async (id: string) => {
    await (supabase as any).from('opening_hours_exceptions').delete().eq('id', id);
    toast.success('Verwijderd');
    load();
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarX className="h-4 w-4" />
          Voeg uitzonderingen toe voor feestdagen, vakantie of speciale openingstijden.
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 border rounded-lg bg-muted/30">
          <div>
            <Label className="text-xs">Datum</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <Switch checked={isClosed} onCheckedChange={setIsClosed} />
            <span className="text-sm">{isClosed ? 'Gesloten deze dag' : 'Aangepaste tijden'}</span>
          </div>
          {!isClosed && (
            <>
              <div>
                <Label className="text-xs">Open vanaf</Label>
                <Input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Sluit om</Label>
                <Input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <Label className="text-xs">Reden (optioneel)</Label>
            <Input placeholder="Bv. Tweede Kerstdag, Privé feest…" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={add} size="sm" className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Toevoegen
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-3">Laden…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">Geen aankomende uitzonderingen.</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium">
                    {format(new Date(it.exception_date), 'EEE d MMM yyyy', { locale: nl })}
                  </div>
                  {it.is_closed ? (
                    <Badge variant="destructive">Gesloten</Badge>
                  ) : (
                    <Badge variant="secondary">{it.open_time}–{it.close_time}</Badge>
                  )}
                  {it.reason && <span className="text-xs text-muted-foreground">{it.reason}</span>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(it.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}