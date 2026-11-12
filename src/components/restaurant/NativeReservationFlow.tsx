import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarCheck, Clock, Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BOOKING_ERROR_TEXT } from '@/lib/reservationIntegration';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  restaurantName: string;
  timezone?: string;
  metricContext: string;
}

type Step = 'pax' | 'date' | 'slot' | 'guest' | 'review' | 'result';
type Guest = { firstName: string; lastName: string; email: string; phone: string; comment: string };
type Result = { reservationId: string; status: string; manageToken?: string; startsAt: string; partySize: number; unconfirmed?: boolean };

class BookingError extends Error { constructor(public code: string, message: string) { super(message); } }

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('reservations', { body });
  if (!error) return data as T;
  let code = 'provider_error';
  let message = 'Er ging iets mis. Probeer het later opnieuw.';
  try {
    const detail = await (error as { context?: Response }).context?.json();
    if (detail?.error) code = detail.error;
    if (detail?.message) message = detail.message;
  } catch { /* network failure */ }
  throw new BookingError(code, BOOKING_ERROR_TEXT[code] ?? message);
}

function todayIn(tz: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function formatLocal(iso: string, tz: string) {
  return new Intl.DateTimeFormat('nl-NL', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

const STEPS: Step[] = ['pax', 'date', 'slot', 'guest', 'review'];

export function NativeReservationFlow({ open, onOpenChange, restaurantId, restaurantName, timezone = 'Europe/Amsterdam', metricContext }: Props) {
  const [step, setStep] = useState<Step>('pax');
  const [pax, setPax] = useState(2);
  const [date, setDate] = useState(() => todayIn(timezone));
  const [slots, setSlots] = useState<{ time: string }[] | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [guest, setGuest] = useState<Guest>({ firstName: '', lastName: '', email: '', phone: '', comment: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idemKey, setIdemKey] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const minDate = useMemo(() => todayIn(timezone), [timezone]);

  useEffect(() => { if (!open && step === 'result') { setStep('pax'); setResult(null); setTime(null); setIdemKey(null); } }, [open, step]);

  const loadSlots = async () => {
    setBusy(true); setError(null); setSlots(null); setTime(null); setIdemKey(null);
    try {
      const res = await call<{ slots: { time: string }[] }>({ action: 'availability', restaurantId, date, partySize: pax });
      setSlots(res.slots);
      setStep('slot');
    } catch (e) {
      setError(e instanceof BookingError ? e.message : 'Beschikbaarheid ophalen mislukt.');
    } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!time) return;
    // One key per review: double clicks and retries can never create a second booking.
    const key = idemKey ?? crypto.randomUUID();
    setIdemKey(key);
    setBusy(true); setError(null);
    try {
      const res = await call<Result>({ action: 'create', restaurantId, date, time, partySize: pax, guest, idempotencyKey: key, dishContext: metricContext });
      setResult(res);
      setStep('result');
    } catch (e) {
      const code = e instanceof BookingError ? e.code : 'provider_error';
      if (code === 'slot_unavailable') { setError(e instanceof Error ? e.message : null); await loadSlots(); return; }
      if (code === 'provider_timeout') { setResult({ reservationId: '', status: 'pending', startsAt: '', partySize: pax, unconfirmed: true }); setStep('result'); return; }
      setError(e instanceof Error ? e.message : 'Reserveren mislukt.');
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!result?.manageToken) return;
    setBusy(true); setError(null);
    try {
      const res = await call<{ status: string }>({ action: 'cancel', reservationId: result.reservationId, token: result.manageToken });
      setResult({ ...result, status: res.status });
    } catch (e) { setError(e instanceof Error ? e.message : 'Annuleren mislukt.'); }
    finally { setBusy(false); }
  };

  const guestValid = guest.firstName.trim() && guest.lastName.trim() && /\S+@\S+\.\S+/.test(guest.email) && guest.phone.replace(/\D/g, '').length >= 8;
  const stepIndex = STEPS.indexOf(step);
  const back = () => setStep(STEPS[Math.max(0, stepIndex - 1)]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reserveer bij {restaurantName}</DialogTitle>
          <DialogDescription>
            {step === 'result' ? 'Status van je reservering' : `Stap ${stepIndex + 1} van ${STEPS.length}. Beschikbaarheid komt rechtstreeks uit het reserveringssysteem van het restaurant.`}
          </DialogDescription>
        </DialogHeader>

        {step !== 'pax' && step !== 'result' && (
          <Button variant="ghost" size="sm" className="w-fit -ml-2" onClick={back} disabled={busy}><ArrowLeft className="h-4 w-4 mr-1" />Terug</Button>
        )}

        {error && <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error}</p>}

        {step === 'pax' && (
          <div className="space-y-4">
            <Label className="flex items-center gap-2"><Users className="h-4 w-4" />Aantal personen</Label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <Button key={n} type="button" variant={pax === n ? 'default' : 'outline'} onClick={() => setPax(n)} aria-pressed={pax === n}>{n}</Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Met meer dan 8 personen? Neem direct contact op met het restaurant.</p>
            <Button className="w-full" onClick={() => setStep('date')}>Verder</Button>
          </div>
        )}

        {step === 'date' && (
          <div className="space-y-4">
            <Label htmlFor="res-date">Datum</Label>
            <Input id="res-date" type="date" min={minDate} value={date} onChange={e => setDate(e.target.value)} />
            <Button className="w-full" onClick={loadSlots} disabled={busy || !date || date < minDate}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Beschikbare tijden tonen'}
            </Button>
          </div>
        )}

        {step === 'slot' && slots && (
          <div className="space-y-4">
            <Label className="flex items-center gap-2"><Clock className="h-4 w-4" />Beschikbare tijden</Label>
            {slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Er zijn geen tijden beschikbaar voor {pax} personen op deze datum. Kies een andere datum.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {slots.map(s => (
                  <Button key={s.time} type="button" variant={time === s.time ? 'default' : 'outline'} onClick={() => { setTime(s.time); setIdemKey(null); }} aria-pressed={time === s.time}>{s.time}</Button>
                ))}
              </div>
            )}
            <Button className="w-full" onClick={() => setStep('guest')} disabled={!time}>Verder</Button>
          </div>
        )}

        {step === 'guest' && (
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (guestValid) setStep('review'); }}>
            <div className="grid grid-cols-2 gap-2">
              <div><Label htmlFor="g-first">Voornaam</Label><Input id="g-first" autoComplete="given-name" maxLength={60} required value={guest.firstName} onChange={e => setGuest({ ...guest, firstName: e.target.value })} /></div>
              <div><Label htmlFor="g-last">Achternaam</Label><Input id="g-last" autoComplete="family-name" maxLength={60} required value={guest.lastName} onChange={e => setGuest({ ...guest, lastName: e.target.value })} /></div>
            </div>
            <div><Label htmlFor="g-email">E-mailadres</Label><Input id="g-email" type="email" autoComplete="email" maxLength={254} required value={guest.email} onChange={e => setGuest({ ...guest, email: e.target.value })} /></div>
            <div><Label htmlFor="g-phone">Telefoonnummer</Label><Input id="g-phone" type="tel" autoComplete="tel" maxLength={20} required value={guest.phone} onChange={e => setGuest({ ...guest, phone: e.target.value })} /></div>
            <div><Label htmlFor="g-comment">Opmerking of wensen (optioneel)</Label><Textarea id="g-comment" maxLength={500} rows={2} value={guest.comment} onChange={e => setGuest({ ...guest, comment: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Je gegevens gaan rechtstreeks naar het reserveringssysteem van {restaurantName}. Dishloopr bewaart ze niet.</p>
            <Button type="submit" className="w-full" disabled={!guestValid}>Controleren</Button>
          </form>
        )}

        {step === 'review' && time && (
          <div className="space-y-4">
            <dl className="rounded-lg border p-4 text-sm space-y-1">
              <div className="flex justify-between"><dt className="text-muted-foreground">Datum</dt><dd>{new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00Z`))}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Tijd</dt><dd>{time}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Personen</dt><dd>{pax}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Naam</dt><dd>{guest.firstName} {guest.lastName}</dd></div>
            </dl>
            <Button className="w-full" onClick={submit} disabled={busy}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Bezig met reserveren</> : 'Reservering versturen'}
            </Button>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4 text-center">
            <CalendarCheck className={cn('h-10 w-10 mx-auto', result.status === 'confirmed' ? 'text-primary' : 'text-muted-foreground')} />
            {result.unconfirmed ? (
              <p className="text-sm">{BOOKING_ERROR_TEXT.provider_timeout}</p>
            ) : result.status === 'confirmed' ? (
              <p className="text-sm">Je reservering is bevestigd door {restaurantName}: {formatLocal(result.startsAt, timezone)}, {result.partySize} personen.</p>
            ) : result.status === 'pending' ? (
              <p className="text-sm">{restaurantName} heeft je aanvraag ontvangen en moet die nog bevestigen. Je hoort het via het restaurant.</p>
            ) : result.status === 'cancelled' ? (
              <p className="text-sm">Je reservering is geannuleerd.</p>
            ) : (
              <p className="text-sm">Status: {result.status}</p>
            )}
            {result.manageToken && ['confirmed', 'pending'].includes(result.status) && !result.unconfirmed && (
              <Button variant="outline" size="sm" onClick={cancel} disabled={busy}>Reservering annuleren</Button>
            )}
            <Button className="w-full" onClick={() => onOpenChange(false)}>Sluiten</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
