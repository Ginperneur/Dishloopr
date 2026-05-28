import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { nl } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Item {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  end_date: string | null;
}
interface Exception {
  id: string;
  exception_date: string;
  is_closed: boolean;
  reason: string | null;
}

export function EventsCalendarView({ restaurantId }: { restaurantId: string }) {
  const [cursor, setCursor] = useState(new Date());
  const [events, setEvents] = useState<Item[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);

  useEffect(() => {
    (async () => {
      const from = startOfMonth(cursor).toISOString();
      const to = endOfMonth(cursor).toISOString();
      const [{ data: ev }, { data: ex }] = await Promise.all([
        supabase.from('restaurant_events').select('id, title, event_type, event_date, end_date').eq('restaurant_id', restaurantId).gte('event_date', from).lte('event_date', to),
        (supabase as any).from('opening_hours_exceptions').select('id, exception_date, is_closed, reason').eq('restaurant_id', restaurantId).gte('exception_date', from.slice(0, 10)).lte('exception_date', to.slice(0, 10)),
      ]);
      setEvents((ev as Item[]) || []);
      setExceptions((ex as Exception[]) || []);
    })();
  }, [restaurantId, cursor]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const eventsByDay = (d: Date) => events.filter((e) => isSameDay(new Date(e.event_date), d));
  const exceptionByDay = (d: Date) => exceptions.find((e) => isSameDay(new Date(e.exception_date + 'T00:00:00'), d));

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4 text-primary" />
            {format(cursor, 'MMMM yyyy', { locale: nl })}
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => setCursor(subMonths(cursor, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setCursor(new Date())}>Vandaag</Button>
            <Button size="icon" variant="ghost" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-[10px] text-muted-foreground uppercase">
          {['Ma','Di','Wo','Do','Vr','Za','Zo'].map((d) => <div key={d} className="text-center py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const dayEv = eventsByDay(d);
            const ex = exceptionByDay(d);
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  'min-h-[60px] p-1 rounded border text-[10px]',
                  !isSameMonth(d, cursor) && 'opacity-40',
                  ex?.is_closed && 'bg-destructive/10 border-destructive/30'
                )}
              >
                <div className="font-medium">{format(d, 'd')}</div>
                {ex?.is_closed && <Badge variant="destructive" className="text-[9px] mt-0.5">Gesloten</Badge>}
                {dayEv.slice(0, 2).map((e) => (
                  <div key={e.id} className="truncate mt-0.5 px-1 rounded bg-primary/15 text-primary" title={e.title}>{e.title}</div>
                ))}
                {dayEv.length > 2 && <div className="text-muted-foreground">+{dayEv.length - 2}</div>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}