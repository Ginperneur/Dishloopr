import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { CalendarDays, Edit2, Eye, ImagePlus, Loader2, PartyPopper, Plus, Repeat, Trash2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { openConfirm } from '@/components/ui/confirm-dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { CHECKOUT_ENABLED, COMING_SOON_LABEL } from '@/lib/checkoutFlags';
import { EVENT_PRICE_LABEL, EVENT_TYPES, WEEKDAYS, eventTypeLabel, formatSchedule } from '@/lib/events';
import { optimizedImage } from '@/lib/imageUrl';
import { sendAnalyticsEvent } from '@/lib/cookieConsent';
import { useOwnerProCheckout } from '@/hooks/useOwnerProCheckout';

type OwnerEvent = Tables<'restaurant_events'>;

interface FormState {
  title: string;
  description: string;
  event_type: string;
  recurrence: 'none' | 'weekly';
  weekdays: number[];
  date: string;
  until: string;
  start_time: string;
  end_time: string;
  price: string;
  offer: string;
  image_url: string;
}

const emptyForm: FormState = {
  title: '', description: '', event_type: 'special_menu', recurrence: 'none', weekdays: [],
  date: '', until: '', start_time: '', end_time: '', price: '', offer: '', image_url: '',
};

const STATS_DAYS = 30;

function toForm(e: OwnerEvent): FormState {
  const weekly = e.recurrence === 'weekly';
  const start = new Date(e.event_date);
  const legacyTime = !e.start_time && !weekly && format(start, 'HH:mm') !== '00:00' ? format(start, 'HH:mm') : '';
  return {
    title: e.title,
    description: e.description ?? '',
    event_type: EVENT_TYPES.some(t => t.value === e.event_type) ? e.event_type : 'other',
    recurrence: weekly ? 'weekly' : 'none',
    weekdays: e.weekdays ?? [],
    date: weekly && start < new Date() ? '' : format(start, 'yyyy-MM-dd'),
    until: weekly && e.end_date ? format(new Date(e.end_date), 'yyyy-MM-dd') : '',
    start_time: e.start_time?.slice(0, 5) ?? legacyTime,
    end_time: e.end_time?.slice(0, 5) ?? '',
    price: e.price != null ? String(e.price) : '',
    offer: e.offer ?? '',
    image_url: e.image_url ?? '',
  };
}

function isEnded(e: OwnerEvent): boolean {
  const until = e.end_date ?? (e.recurrence === 'weekly' ? null : e.event_date);
  return until !== null && new Date(until) < new Date();
}

/** Resizes to max 1600px wide WebP before upload, like the restaurant photo uploader. */
async function toWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Kon foto niet verwerken'))), 'image/webp', 0.85));
}

function StatusBadge({ event }: { event: OwnerEvent }) {
  if (!event.is_active) return <Badge variant="outline">Gestopt</Badge>;
  if (isEnded(event)) return <Badge variant="outline">Afgelopen</Badge>;
  if (event.promotion_status === 'paid' || event.promotion_status === 'comped') return <Badge>Zichtbaar</Badge>;
  if (event.promotion_status === 'lapsed') return <Badge variant="secondary">Abonnement gestopt</Badge>;
  return <Badge variant="secondary">Nog niet zichtbaar</Badge>;
}

interface OwnerEventsManagerProps {
  restaurantId: string;
  restaurantName: string;
}

export function OwnerEventsManager({ restaurantId, restaurantName }: OwnerEventsManagerProps) {
  const queryClient = useQueryClient();
  const { openPortal, portalLoading } = useOwnerProCheckout();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OwnerEvent | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);

  const eventsKey = ['owner-events', restaurantId];
  const { data: events = [], isLoading } = useQuery({
    queryKey: eventsKey,
    queryFn: async () => {
      const { data, error } = await supabase.from('restaurant_events').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['owner-event-stats', restaurantId, STATS_DAYS],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('owner_event_stats', { p_restaurant_id: restaurantId, p_from: format(subDays(new Date(), STATS_DAYS), 'yyyy-MM-dd') });
      if (error) throw error;
      const byEvent = new Map<string, { impressie: number; bekeken: number; klik: number }>();
      for (const row of data ?? []) {
        const s = byEvent.get(row.event_id) ?? { impressie: 0, bekeken: 0, klik: 0 };
        if (row.metric === 'impressie' || row.metric === 'bekeken' || row.metric === 'klik') s[row.metric] += Number(row.totaal);
        byEvent.set(row.event_id, s);
      }
      return byEvent;
    },
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: eventsKey });
    queryClient.invalidateQueries({ queryKey: ['public-events'] });
  };

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const { error } = await supabase.rpc('save_restaurant_event', {
        p_event_id: editing?.id ?? null,
        p_restaurant_id: restaurantId,
        p_title: f.title,
        p_description: f.description || null,
        p_event_type: f.event_type,
        p_recurrence: f.recurrence,
        p_weekdays: f.recurrence === 'weekly' ? f.weekdays : [],
        p_date: f.date || null,
        p_until: f.recurrence === 'weekly' ? f.until || null : null,
        p_start_time: f.start_time || null,
        p_end_time: f.end_time || null,
        p_price: f.price === '' ? null : Number(f.price),
        p_offer: f.offer || null,
        p_image_url: f.image_url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editing ? 'Evenement bijgewerkt' : 'Evenement aangemaakt');
      setDialogOpen(false);
      refresh();
    },
    onError: (e: Error) => toast.error('Opslaan lukte niet', { description: e.message }),
  });

  const setActive = async (event: OwnerEvent, active: boolean) => {
    const { error } = await supabase.rpc('set_restaurant_event_active', { p_event_id: event.id, p_active: active });
    if (error) { toast.error('Kon evenement niet aanpassen'); return; }
    toast.success(active ? 'Evenement staat weer aan' : 'Evenement gestopt');
    refresh();
  };

  const remove = async (event: OwnerEvent) => {
    if (event.promotion_status === 'paid') {
      toast.info('Zeg eerst het abonnement van dit evenement op via Abonnement beheren. Stoppen kan wel meteen.');
      return;
    }
    if (!(await openConfirm(`"${event.title}" verwijderen? Dit kan niet ongedaan worden.`))) return;
    const { error } = await supabase.rpc('delete_restaurant_event', { p_event_id: event.id });
    if (error) { toast.error('Kon evenement niet verwijderen'); return; }
    toast.success('Evenement verwijderd');
    refresh();
  };

  const startCheckout = async (event: OwnerEvent) => {
    sendAnalyticsEvent('click_package', { package: 'event_promotion' });
    setCheckoutId(event.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-event-checkout', { body: { event_id: event.id } });
      if (error) throw error;
      if (!data?.url) throw new Error('Geen checkout URL ontvangen');
      window.open(data.url, '_blank');
    } catch (e) {
      toast.error('Kon betalen niet starten', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setCheckoutId(null);
    }
  };

  const uploadPhoto = async (file: File) => {
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
      toast.error('Kies een afbeelding van maximaal 10 MB');
      return;
    }
    setUploading(true);
    try {
      const path = `${restaurantId}/events/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
      const { error } = await supabase.storage.from('restaurant-images').upload(path, await toWebp(file), { contentType: 'image/webp' });
      if (error) throw error;
      const { data } = supabase.storage.from('restaurant-images').getPublicUrl(path);
      setForm(f => ({ ...f, image_url: data.publicUrl }));
    } catch (e) {
      toast.error('Uploaden lukte niet', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (e: OwnerEvent) => { setEditing(e); setForm(toForm(e)); setDialogOpen(true); };

  const submit = () => {
    if (!form.title.trim()) return toast.error('Geef je evenement een titel');
    if (form.recurrence === 'none' && !form.date) return toast.error('Kies een datum');
    if (form.recurrence === 'weekly' && form.weekdays.length === 0) return toast.error('Kies minstens één dag');
    save.mutate(form);
  };

  const toggleDay = (d: number) =>
    setForm(f => ({ ...f, weekdays: f.weekdays.includes(d) ? f.weekdays.filter(x => x !== d) : [...f.weekdays, d].sort() }));

  const hasPaid = events.some(e => e.promotion_status === 'paid');

  if (isLoading) {
    return <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-sm text-muted-foreground">
          <p>Zet je specials en evenementen op Dishloopr, zoals een ladies night, onbeperkt steak of een pubquiz.</p>
          <p className="mt-1">
            Prijs: <strong className="text-foreground">{EVENT_PRICE_LABEL}</strong>, maandelijks opzegbaar.
            Elke maand krijg je een mail met hoe vaak je evenement is bekeken.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {hasPaid && (
            <Button variant="outline" size="sm" className="min-h-11" onClick={openPortal} disabled={portalLoading}>Abonnement beheren</Button>
          )}
          <Button size="sm" className="min-h-11" onClick={openCreate}><Plus className="mr-1 h-4 w-4" />Nieuw evenement</Button>
        </div>
      </div>

      {!CHECKOUT_ENABLED.event && (
        <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
          Online betalen voor evenementen is {COMING_SOON_LABEL.toLowerCase()}. Tot die tijd bekijken wij nieuwe evenementen zelf en zetten we ze voor je online.
        </p>
      )}

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <PartyPopper className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="mb-3 text-sm text-muted-foreground">Je hebt nog geen evenementen voor {restaurantName}.</p>
            <Button onClick={openCreate} variant="outline" size="sm" className="min-h-11"><Plus className="mr-1 h-4 w-4" />Maak je eerste evenement</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map(event => {
            const s = stats?.get(event.id);
            const needsPayment = event.is_active && !isEnded(event) && (event.promotion_status === 'unpaid' || event.promotion_status === 'lapsed');
            const visible = event.is_active && !isEnded(event) && (event.promotion_status === 'paid' || event.promotion_status === 'comped');
            return (
              <Card key={event.id} className={!event.is_active || isEnded(event) ? 'opacity-70' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="hidden h-14 w-20 shrink-0 overflow-hidden rounded-md bg-primary/10 sm:block">
                      {event.image_url
                        ? <img src={optimizedImage(event.image_url, { width: 160 })} alt="" width={80} height={56} loading="lazy" className="h-full w-full object-cover" />
                        : <div className="flex h-full items-center justify-center"><CalendarDays className="h-5 w-5 text-primary" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold">{event.title}</h4>
                        <StatusBadge event={event} />
                        <Badge variant="outline" className="text-xs">{eventTypeLabel(event.event_type)}</Badge>
                      </div>
                      <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground first-letter:uppercase">
                        {event.recurrence === 'weekly' && <Repeat className="h-3.5 w-3.5 shrink-0" />}
                        {formatSchedule(event)}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Eye className="h-3.5 w-3.5" />
                        Afgelopen {STATS_DAYS} dagen: {s?.impressie ?? 0} keer in beeld, {s?.bekeken ?? 0} keer bekeken
                        {s?.klik ? `, ${s.klik} kliks naar reserveren of website` : ''}
                      </p>
                      {visible && (
                        <Link to={`/evenementen/${event.id}`} target="_blank" className="mt-1 inline-block text-xs text-primary underline-offset-4 hover:underline">Bekijk openbare pagina</Link>
                      )}
                      {needsPayment && (
                        <div className="mt-3">
                          {CHECKOUT_ENABLED.event ? (
                            <Button size="sm" className="min-h-11" onClick={() => startCheckout(event)} disabled={checkoutId === event.id}>
                              {checkoutId === event.id && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                              Zet online voor €5 per maand
                            </Button>
                          ) : (
                            <p className="text-xs text-muted-foreground">Wacht op vrijgave door Dishloopr.</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Switch checked={!!event.is_active} onCheckedChange={v => setActive(event, v)} aria-label={event.is_active ? 'Evenement stoppen' : 'Evenement weer aanzetten'} />
                      <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => openEdit(event)} aria-label="Bewerken"><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive" onClick={() => remove(event)} aria-label="Verwijderen"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Evenement bewerken' : 'Nieuw evenement'}</DialogTitle>
            <DialogDescription>Gasten zien dit op de evenementenpagina en op je restaurantpagina.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="event-title">Titel</Label>
              <Input id="event-title" maxLength={80} placeholder="Bijvoorbeeld: Onbeperkt steak" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            <div>
              <Label htmlFor="event-type">Soort</Label>
              <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                <SelectTrigger id="event-type"><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="event-description">Korte omschrijving</Label>
              <Textarea id="event-description" maxLength={600} rows={3} placeholder="Wat maakt deze avond speciaal?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Wanneer</legend>
              <div className="grid grid-cols-2 gap-2">
                {([['none', 'Op een datum'], ['weekly', 'Elke week']] as const).map(([value, label]) => (
                  <Button key={value} type="button" variant={form.recurrence === value ? 'default' : 'outline'} className="min-h-11" aria-pressed={form.recurrence === value} onClick={() => setForm(f => ({ ...f, recurrence: value }))}>
                    {label}
                  </Button>
                ))}
              </div>

              {form.recurrence === 'weekly' ? (
                <>
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dagen">
                    {WEEKDAYS.map(d => (
                      <Button key={d.value} type="button" size="sm" variant={form.weekdays.includes(d.value) ? 'default' : 'outline'} className="h-11 w-11 p-0" aria-pressed={form.weekdays.includes(d.value)} aria-label={d.long} onClick={() => toggleDay(d.value)}>
                        {d.short}
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="event-from">Vanaf (optioneel)</Label>
                      <Input id="event-from" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="event-until">Tot en met (optioneel)</Label>
                      <Input id="event-until" type="date" value={form.until} onChange={e => setForm(f => ({ ...f, until: e.target.value }))} />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <Label htmlFor="event-date">Datum</Label>
                  <Input id="event-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="event-start">Begintijd (optioneel)</Label>
                  <Input id="event-start" type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="event-end">Eindtijd (optioneel)</Label>
                  <Input id="event-end" type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
                </div>
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="event-price">Prijs in € (optioneel)</Label>
                <Input id="event-price" type="number" inputMode="decimal" min="0" step="0.5" placeholder="0 is gratis" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="event-offer">Aanbieding (optioneel)</Label>
                <Input id="event-offer" maxLength={120} placeholder="2e cocktail gratis" value={form.offer} onChange={e => setForm(f => ({ ...f, offer: e.target.value }))} />
              </div>
            </div>

            <div>
              <Label>Foto (optioneel)</Label>
              {form.image_url ? (
                <div className="relative mt-1.5 overflow-hidden rounded-lg">
                  <img src={optimizedImage(form.image_url, { width: 480 })} alt="" width={480} height={270} className="aspect-video w-full object-cover" />
                  <Button type="button" variant="secondary" size="icon" className="absolute right-2 top-2 h-9 w-9" aria-label="Foto verwijderen" onClick={() => setForm(f => ({ ...f, image_url: '' }))}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="mt-1.5 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted/50">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                  {uploading ? 'Bezig met uploaden' : 'Kies een foto'}
                  <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) uploadPhoto(file); e.target.value = ''; }} />
                </label>
              )}
              <p className="mt-1 text-xs text-muted-foreground">Zonder foto gebruiken we de eerste foto van je restaurant.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={submit} disabled={save.isPending || uploading} className="min-h-11 flex-1">
                {save.isPending ? 'Opslaan' : editing ? 'Bijwerken' : 'Aanmaken'}
              </Button>
              <Button variant="outline" className="min-h-11" onClick={() => setDialogOpen(false)}>Annuleren</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
