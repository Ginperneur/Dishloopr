import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, Loader2, Lock, Plug, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ERROR_LABELS, STATUS_LABELS, integrationStatus, type IntegrationRow, type IntegrationStatus } from '@/lib/reservationIntegration';
import { ZENCHEF_LANGS, parseZenchefRestaurantId, zenchefBookingUrl } from '@/lib/zenchef';

type Rpc = (fn: string, args: unknown) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc = supabase.rpc as unknown as Rpc;
// The new tables are not in the generated types yet (regenerate after the migration runs).
type Eq = { eq: (k: string, v: string) => Eq; maybeSingle: () => PromiseLike<{ data: IntegrationRow | null; error: Error | null }> };
const db = supabase as unknown as { from: (t: string) => { select: (c: string) => Eq } };

const STATUS_VARIANT: Record<IntegrationStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  not_connected: 'outline', config_required: 'secondary', testing: 'secondary', connected: 'default', limited: 'secondary', error: 'destructive',
};

const LANG_LABELS: Record<string, string> = { nl: 'Nederlands', en: 'Engels', de: 'Duits', fr: 'Frans', es: 'Spaans', it: 'Italiaans', pt: 'Portugees' };

function friendly(message: string) {
  if (/al aan een ander restaurant/i.test(message)) return 'Dit Zenchef-restaurant is al aan een ander Dishloopr-restaurant gekoppeld. Neem contact op met Dishloopr als dit niet klopt.';
  if (/Not authorized/i.test(message)) return 'Alleen de geverifieerde eigenaar kan reserveringen koppelen.';
  return message;
}

export function ReservationIntegrations({ restaurantId }: { restaurantId: string }) {
  const qc = useQueryClient();
  const key = ['reservation-integration', restaurantId];
  const [input, setInput] = useState('');
  const [lang, setLang] = useState<string>('auto');
  const [testResult, setTestResult] = useState<string | null>(null);

  const { data: row, isLoading } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<IntegrationRow | null> => {
      const { data, error } = await db.from('restaurant_integrations').select('*').eq('restaurant_id', restaurantId).eq('provider', 'zenchef').maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['reservation-options', restaurantId] });
  };

  const call = (fn: string, args: Record<string, unknown>) => async () => {
    const { error } = await rpc(fn, args);
    if (error) throw new Error(friendly(error.message));
  };

  const save = useMutation({
    mutationFn: async () => {
      const id = parseZenchefRestaurantId(input);
      if (!id) throw new Error('Vul je Zenchef-restaurant-ID in, of plak de link of embedcode uit Zenchef.');
      await call('save_reservation_integration', {
        p_restaurant_id: restaurantId, p_provider: 'zenchef', p_external_id: id, p_method: 'widget',
        p_config: lang === 'auto' ? {} : { lang },
      })();
    },
    onSuccess: () => { setInput(''); refresh(); toast.success('Opgeslagen. Controleer nu of de widget jouw restaurant toont.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: call('confirm_reservation_integration', { p_restaurant_id: restaurantId, p_provider: 'zenchef' }),
    onSuccess: () => { refresh(); toast.success('Zenchef is gekoppeld. De reserveerknop staat live op je pagina.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => call('set_reservation_integration_enabled', { p_restaurant_id: restaurantId, p_provider: 'zenchef', p_enabled: enabled })(),
    onSuccess: (_d, enabled) => { refresh(); toast.success(enabled ? 'Reserveren via Dishloopr staat aan.' : 'Reserveren via Dishloopr staat tijdelijk uit.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const disconnect = useMutation({
    mutationFn: call('disconnect_reservation_integration', { p_restaurant_id: restaurantId, p_provider: 'zenchef' }),
    onSuccess: () => { refresh(); setTestResult(null); toast.success('Zenchef is ontkoppeld.'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('reservations', { body: { action: 'test', restaurantId } });
      if (error) throw new Error('Testen mislukt. Probeer het later opnieuw.');
      return data as { ok: boolean; code: string };
    },
    onSuccess: (r) => {
      setTestResult(r.code === 'widget_only'
        ? 'De widgetkoppeling is actief. Realtime beschikbaarheid en reserveren binnen Dishloopr vragen API-toegang bij Zenchef; die is er nog niet.'
        : r.ok ? 'De API-verbinding werkt.' : ERROR_LABELS[r.code] ?? 'De verbinding werkt niet.');
      refresh();
    },
    onError: (e: Error) => setTestResult(e.message),
  });

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Laden</div>;

  const status = integrationStatus(row);
  const live = !!row && (row.status === 'connected' || row.status === 'limited');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Plug className="h-4 w-4" />Zenchef</CardTitle>
              <CardDescription>Gasten reserveren vanaf je Dishloopr-pagina in je eigen Zenchef. Beschikbaarheid en tafelbeheer blijven in Zenchef.</CardDescription>
            </div>
            <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {(!row || status === 'error') && (
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
              <div className="space-y-1.5">
                <Label htmlFor="zc-id">Zenchef-restaurant-ID</Label>
                <Input id="zc-id" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Bijvoorbeeld 378183, of plak je Zenchef-link of embedcode" autoComplete="off" />
                <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                  <li>Log in op ZenchefOS en open de instellingen van je reserveringsmodule (de widget op je website).</li>
                  <li>Kopieer je reserveringslink, of alleen het nummer achter <code>rid=</code> in die link.</li>
                  <li>Plak de link of het nummer hierboven en klik op <span className="font-medium">Koppelen</span>.</li>
                  <li>Controleer daarna op je restaurantpagina dat de knop Reserveren de Zenchef-widget opent.</li>
                </ol>
                <p className="text-xs text-muted-foreground">
                  We gebruiken alleen het ID; scripts of andere code worden nooit overgenomen. Kom je er niet uit? Stuur ons via de chat je reserveringslink, dan koppelen wij het.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Taal van de widget</Label>
                <Select value={lang} onValueChange={setLang}>
                  <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Taal van je Zenchef-account</SelectItem>
                    {ZENCHEF_LANGS.map((l) => <SelectItem key={l} value={l}>{LANG_LABELS[l]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={save.isPending || !input.trim()}>
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Koppelen
              </Button>
            </form>
          )}

          {row && status === 'testing' && (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              <p className="text-sm font-medium">Controleer de koppeling met Zenchef-ID {row.external_restaurant_id}</p>
              <p className="text-sm text-muted-foreground">Open het testvenster. Zie je jouw eigen restaurant? Bevestig dan de koppeling. Pas daarna verschijnt de reserveerknop op je pagina.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" asChild>
                  <a href={zenchefBookingUrl(row.external_restaurant_id, { lang: row.config?.lang })} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Testvenster openen</a>
                </Button>
                <Button onClick={() => confirm.mutate()} disabled={confirm.isPending}>
                  {confirm.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Ja, dit is mijn restaurant
                </Button>
                <Button variant="ghost" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>Nee, ander ID invullen</Button>
              </div>
            </div>
          )}

          {row && live && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">Reserveren via Dishloopr</p>
                  <p className="text-xs text-muted-foreground">Zet tijdelijk uit om de reserveerknop te verbergen. Je koppeling blijft bewaard.</p>
                </div>
                <Switch checked={row.enabled} onCheckedChange={(v) => toggle.mutate(v)} disabled={toggle.isPending} aria-label="Reserveren via Dishloopr" />
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><dt className="text-muted-foreground">Zenchef-ID</dt><dd className="font-medium">{row.external_restaurant_id}</dd></div>
                <div><dt className="text-muted-foreground">Koppelmethode</dt><dd className="font-medium">Officiële Zenchef-widget</dd></div>
                <div><dt className="text-muted-foreground">Bevestigd op</dt><dd>{row.verified_at ? new Date(row.verified_at).toLocaleDateString('nl-NL') : 'Onbekend'}</dd></div>
                <div><dt className="text-muted-foreground">Laatste synchronisatie</dt><dd>{row.last_synced_at ? new Date(row.last_synced_at).toLocaleString('nl-NL') : 'Niet van toepassing bij de widget'}</dd></div>
              </dl>

              <ul className="text-sm space-y-1.5">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />Reserveerknop opent je officiële Zenchef-widget</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" />Klikken en geopende reserveringen worden gemeten</li>
                <li className="flex items-center gap-2 text-muted-foreground"><Lock className="h-4 w-4" />Bevestigde reserveringen tellen en reserveren binnen Dishloopr: wacht op API-toegang bij Zenchef</li>
              </ul>

              {row.last_error_code && (
                <p className="text-sm text-destructive flex items-center gap-2"><XCircle className="h-4 w-4" />{ERROR_LABELS[row.last_error_code] ?? row.last_error_code}{row.last_error_at ? ` (${new Date(row.last_error_at).toLocaleString('nl-NL')})` : ''}</p>
              )}
              {testResult && <p className="text-sm rounded-md bg-muted p-3">{testResult}</p>}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
                  {test.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Verbinding testen
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="ghost" className="text-destructive">Verbinding verbreken</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Zenchef ontkoppelen?</AlertDialogTitle>
                      <AlertDialogDescription>De reserveerknop verdwijnt van je pagina en de koppelgegevens worden verwijderd. Je reserveringen in Zenchef blijven gewoon bestaan.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                      <AlertDialogAction onClick={() => disconnect.mutate()}>Ontkoppelen</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}

          {row && status === 'config_required' && (
            <p className="text-sm text-muted-foreground">De volledige API-koppeling vraagt toegang die Zenchef nog moet verlenen. Ontkoppel en kies de widget om nu al reserveringen te ontvangen.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" />Reserveren binnen Dishloopr (Zenchef API)</CardTitle>
          <CardDescription>
            Gasten kiezen dan datum, tijd en personen zonder Dishloopr te verlaten, en je ziet precies welke reserveringen Dishloopr opleverde.
            Hiervoor is API-toegang van Zenchef nodig (Grow-abonnement of aparte afspraak). Zodra die er is, zetten wij dit voor je aan.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
