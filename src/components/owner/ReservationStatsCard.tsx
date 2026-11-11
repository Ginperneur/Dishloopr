import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { summarizeReservationStats, type ReservationStatsRow } from '@/lib/reservationIntegration';

const rpc = supabase.rpc as unknown as (fn: string, args: unknown) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

function Tile({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}

export function ReservationStatsCard({ restaurantId }: { restaurantId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['reservation-stats', restaurantId],
    queryFn: async () => {
      const { data, error } = await rpc('reservation_stats_summary', { p_restaurant_id: restaurantId, p_days: 30 });
      if (error) throw error;
      return summarizeReservationStats((data ?? []) as ReservationStatsRow[]);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><CalendarCheck className="h-4 w-4" />Reserveringen via Dishloopr (30 dagen)</CardTitle>
        <CardDescription>We houden klikken, gestarte reserveringen en bevestigde reserveringen strikt uit elkaar.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Laden</p>}
        {isError && <p className="text-sm text-muted-foreground">Statistieken zijn nu niet beschikbaar.</p>}
        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Tile label="Klikken op reserveren" value={data.clicks} hint="Gemeten klikken op je reserveerknop." />
              <Tile label="Gestarte reserveringen" value={data.flowsStarted + data.widgetOpened} hint="Reserveringsmodule geopend vanaf Dishloopr." />
              <Tile label="Gemeld door widget" value={data.widgetReported} hint="De Zenchef-widget meldde een boeking in de browser. Niet door Zenchef bevestigd." />
              <Tile label="Bevestigd via Dishloopr" value={data.confirmed} hint={`Aantoonbaar door Zenchef bevestigd${data.cancelled ? `, ${data.cancelled} geannuleerd` : ''}.`} />
            </div>
            {data.conversionRate !== null && data.confirmed > 0 && (
              <p className="text-sm">Conversie van klik naar bevestigde reservering: <span className="font-medium">{data.conversionRate}%</span></p>
            )}
            {data.confirmedByDish.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-1">Bevestigde reserveringen per gerecht</p>
                <ul className="text-sm text-muted-foreground space-y-0.5">
                  {data.confirmedByDish.map((d) => <li key={d.dish}>{d.dish.replace(/-/g, ' ')}: {d.count}</li>)}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground flex gap-1.5"><Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />Bevestigde reserveringen tellen we alleen als Zenchef ze aantoonbaar heeft aangenomen. Met de widget alleen is dat nog niet te bewijzen; daarvoor is API-toegang nodig.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
