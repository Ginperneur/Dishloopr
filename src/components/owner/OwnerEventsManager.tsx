import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Calendar, Plus, Trash2, Edit2, PartyPopper, Wine, ChefHat, Utensils, Tag, Euro, Users, Save, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import { openConfirm } from '@/components/ui/confirm-dialog';
interface RestaurantEvent {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  event_type: string;
  event_date: string;
  end_date: string | null;
  price: number | null;
  max_participants: number | null;
  current_participants: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

const EVENT_TYPES = [
  { value: 'ladies_night', label: 'Ladies Night', icon: PartyPopper },
  { value: 'discount', label: 'Korting / Actie', icon: Tag },
  { value: 'tasting', label: 'Proeverij', icon: Wine },
  { value: 'chefs_table', label: "Chef's Table", icon: ChefHat },
  { value: 'special_menu', label: 'Speciaal Menu', icon: Utensils },
  { value: 'workshop', label: 'Workshop', icon: ChefHat },
];

const eventTypeIcons: Record<string, React.ElementType> = Object.fromEntries(
  EVENT_TYPES.map(t => [t.value, t.icon])
);

interface OwnerEventsManagerProps {
  restaurantId: string;
  restaurantName: string;
}

interface EventFormData {
  title: string;
  description: string;
  event_type: string;
  event_date: string;
  end_date: string;
  price: string;
  max_participants: string;
  image_url: string;
  is_active: boolean;
}

const emptyForm: EventFormData = {
  title: '',
  description: '',
  event_type: 'discount',
  event_date: '',
  end_date: '',
  price: '',
  max_participants: '',
  image_url: '',
  is_active: true,
};

export function OwnerEventsManager({ restaurantId, restaurantName }: OwnerEventsManagerProps) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<RestaurantEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<RestaurantEvent | null>(null);
  const [form, setForm] = useState<EventFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurant_events')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('event_date', { ascending: false });

    if (!error && data) {
      setEvents(data.map(e => ({
        ...e,
        price: e.price ? Number(e.price) : null,
        is_active: e.is_active ?? true,
        current_participants: e.current_participants ?? 0,
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (restaurantId) fetchEvents();
  }, [restaurantId]);

  const openCreate = () => {
    setEditingEvent(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (event: RestaurantEvent) => {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type,
      event_date: event.event_date ? event.event_date.slice(0, 16) : '',
      end_date: event.end_date ? event.end_date.slice(0, 16) : '',
      price: event.price != null ? String(event.price) : '',
      max_participants: event.max_participants != null ? String(event.max_participants) : '',
      image_url: event.image_url || '',
      is_active: event.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.event_date) {
      toast.error('Titel en datum zijn verplicht');
      return;
    }

    setSaving(true);
    const payload = {
      restaurant_id: restaurantId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_type: form.event_type,
      event_date: new Date(form.event_date).toISOString(),
      end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
      price: form.price ? Number(form.price) : null,
      max_participants: form.max_participants ? Number(form.max_participants) : null,
      image_url: form.image_url.trim() || null,
      is_active: form.is_active,
    };

    let error;
    if (editingEvent) {
      ({ error } = await supabase
        .from('restaurant_events')
        .update(payload)
        .eq('id', editingEvent.id));
    } else {
      ({ error } = await supabase
        .from('restaurant_events')
        .insert(payload));
    }

    setSaving(false);
    if (error) {
      toast.error('Kon event niet opslaan: ' + error.message);
    } else {
      toast.success(editingEvent ? 'Event bijgewerkt' : 'Event aangemaakt');
      setDialogOpen(false);
      fetchEvents();
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!(await openConfirm('Weet je zeker dat je dit event wilt verwijderen?'))) return;
    const { error } = await supabase
      .from('restaurant_events')
      .delete()
      .eq('id', eventId);

    if (error) {
      toast.error('Kon event niet verwijderen');
    } else {
      toast.success('Event verwijderd');
      fetchEvents();
    }
  };

  const toggleActive = async (event: RestaurantEvent) => {
    const { error } = await supabase
      .from('restaurant_events')
      .update({ is_active: !event.is_active })
      .eq('id', event.id);

    if (!error) {
      toast.success(event.is_active ? 'Event gedeactiveerd' : 'Event geactiveerd');
      fetchEvents();
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Plaats acties, evenementen en kortingen om extra klanten aan te trekken.
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Nieuw event
        </Button>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <PartyPopper className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground text-sm mb-3">Je hebt nog geen events of acties geplaatst</p>
            <Button onClick={openCreate} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Maak je eerste event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {events.map(event => {
            const Icon = eventTypeIcons[event.event_type] || Calendar;
            const isPast = new Date(event.event_date) < new Date();
            const typeLabel = EVENT_TYPES.find(t => t.value === event.event_type)?.label || event.event_type;

            return (
              <Card key={event.id} className={`transition-all ${!event.is_active || isPast ? 'opacity-60' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm">{event.title}</h4>
                        <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
                        {!event.is_active && <Badge variant="outline" className="text-xs">Inactief</Badge>}
                        {isPast && <Badge variant="outline" className="text-xs text-muted-foreground">Verlopen</Badge>}
                      </div>
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{event.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(event.event_date), 'd MMM yyyy HH:mm', { locale: nl })}
                        </span>
                        {event.price != null && (
                          <span className="flex items-center gap-1">
                            <Euro className="h-3 w-3" />
                            {event.price === 0 ? 'Gratis' : `€${event.price}`}
                          </span>
                        )}
                        {event.max_participants && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {event.current_participants}/{event.max_participants}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActive(event)}>
                        <Switch checked={event.is_active} className="pointer-events-none scale-75" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(event)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(event.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEvent ? 'Event bewerken' : 'Nieuw event aanmaken'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="event-title">Titel *</Label>
              <Input
                id="event-title"
                placeholder="Bijv. Ladies Night - 50% korting op cocktails"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="event-type">Type</Label>
              <Select value={form.event_type} onValueChange={v => setForm(f => ({ ...f, event_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="event-description">Beschrijving</Label>
              <Textarea
                id="event-description"
                placeholder="Beschrijf je event of actie..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="event-date">Startdatum *</Label>
                <Input
                  id="event-date"
                  type="datetime-local"
                  value={form.event_date}
                  onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="event-end-date">Einddatum</Label>
                <Input
                  id="event-end-date"
                  type="datetime-local"
                  value={form.end_date}
                  onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="event-price">Prijs (€)</Label>
                <Input
                  id="event-price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0 = gratis"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="event-max">Max deelnemers</Label>
                <Input
                  id="event-max"
                  type="number"
                  min="1"
                  placeholder="Optioneel"
                  value={form.max_participants}
                  onChange={e => setForm(f => ({ ...f, max_participants: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="event-image">Afbeelding URL</Label>
              <Input
                id="event-image"
                type="url"
                placeholder="https://..."
                value={form.image_url}
                onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
              <Label>Direct actief en zichtbaar</Label>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="h-4 w-4 mr-1" />
                {saving ? 'Opslaan...' : editingEvent ? 'Bijwerken' : 'Aanmaken'}
              </Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuleren
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
