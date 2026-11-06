import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Inbox, Loader2, Undo2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CHECKOUT_ENABLED } from '@/lib/checkoutFlags';
import { eventTypeLabel, formatSchedule } from '@/lib/events';

type Filter = 'unpaid' | 'comped' | 'paid';

/**
 * While event checkout is off (CHECKOUT_ENABLED.event), admins release events by
 * setting promotion_status to 'comped'. Paid events are listed for reference.
 */
export function EventReleaseQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('unpaid');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin-event-releases', filter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_events')
        .select('*, restaurant:restaurant_id(name, slug)')
        .eq('promotion_status', filter)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const setStatus = async (id: string, status: 'comped' | 'unpaid') => {
    setBusyId(id);
    const { error } = await supabase
      .from('restaurant_events')
      .update(status === 'comped'
        ? { promotion_status: 'comped', released_by: user?.id ?? null, released_at: new Date().toISOString() }
        : { promotion_status: 'unpaid', released_by: null, released_at: null })
      .eq('id', id);
    setBusyId(null);
    if (error) { toast.error('Kon status niet aanpassen', { description: error.message }); return; }
    toast.success(status === 'comped' ? 'Evenement vrijgegeven' : 'Vrijgave ingetrokken');
    queryClient.invalidateQueries({ queryKey: ['admin-event-releases'] });
    queryClient.invalidateQueries({ queryKey: ['public-events'] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evenementen vrijgeven</CardTitle>
        <CardDescription>
          {CHECKOUT_ENABLED.event
            ? 'Online betalen staat aan. Vrijgeven zet een evenement gratis online, zonder abonnement.'
            : 'Online betalen staat nog uit. Een evenement is pas publiek zichtbaar nadat je het hier vrijgeeft.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={filter} onValueChange={v => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="unpaid">Wacht op vrijgave</TabsTrigger>
            <TabsTrigger value="comped">Vrijgegeven</TabsTrigger>
            <TabsTrigger value="paid">Betaald</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground"><Inbox className="mx-auto mb-2 h-8 w-8" />Niets in deze lijst</div>
        ) : (
          <div className="space-y-3">
            {items.map(e => {
              const restaurant = e.restaurant as unknown as { name: string; slug: string } | null;
              return (
                <div key={e.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{e.title}</span>
                      <Badge variant="outline">{eventTypeLabel(e.event_type)}</Badge>
                      {!e.is_active && <Badge variant="secondary">Door eigenaar gestopt</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {restaurant ? <Link to={`/restaurant/${restaurant.slug}`} className="underline-offset-4 hover:underline">{restaurant.name}</Link> : 'Onbekend restaurant'}
                      {' · '}<span className="first-letter:uppercase">{formatSchedule(e)}</span>
                    </p>
                    {e.description && <p className="mt-1 text-sm line-clamp-2">{e.description}</p>}
                  </div>
                  {filter === 'unpaid' && (
                    <Button size="sm" className="min-h-11 shrink-0" disabled={busyId === e.id} onClick={() => setStatus(e.id, 'comped')}>
                      <Check className="mr-1 h-4 w-4" />Vrijgeven
                    </Button>
                  )}
                  {filter === 'comped' && (
                    <Button size="sm" variant="outline" className="min-h-11 shrink-0" disabled={busyId === e.id} onClick={() => setStatus(e.id, 'unpaid')}>
                      <Undo2 className="mr-1 h-4 w-4" />Intrekken
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
