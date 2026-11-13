import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Save, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { checkHoursInput } from '@/lib/openingHoursInput';

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'Maandag' },
  { key: 'tue', label: 'Dinsdag' },
  { key: 'wed', label: 'Woensdag' },
  { key: 'thu', label: 'Donderdag' },
  { key: 'fri', label: 'Vrijdag' },
  { key: 'sat', label: 'Zaterdag' },
  { key: 'sun', label: 'Zondag' },
];

interface Props {
  restaurantId: string;
  currentName: string;
  currentOpeningHours: any;
  /** Called after opening hours were saved directly, so the dashboard shows them right away. */
  onHoursSaved?: (hours: Record<string, string>) => void;
}

type Pending = {
  id: string;
  status: string;
  proposed_changes: any;
  created_at: string;
  review_notes: string | null;
};

export function BasicInfoEditor({ restaurantId, currentName, currentOpeningHours, onHoursSaved }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState(currentName || '');
  const [descriptionNl, setDescriptionNl] = useState('');
  const [descriptionOriginal, setDescriptionOriginal] = useState('');
  const [hours, setHours] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);

  useEffect(() => {
    setName(currentName || '');
    // Seed hours from current opening_hours object
    const seed: Record<string, string> = {};
    if (currentOpeningHours && typeof currentOpeningHours === 'object') {
      for (const d of DAYS) {
        const v = (currentOpeningHours as any)[d.key];
        if (typeof v === 'string') seed[d.key] = v;
      }
    }
    setHours(seed);
    loadDescription();
    loadPending();
  }, [restaurantId, currentName]);

  const loadDescription = async () => {
    const { data } = await (supabase as any)
      .from('restaurant_translations')
      .select('description')
      .eq('restaurant_id', restaurantId)
      .eq('language_code', 'nl')
      .maybeSingle();
    setDescriptionNl(data?.description || '');
    setDescriptionOriginal(data?.description || '');
  };

  const loadPending = async () => {
    const { data } = await supabase
      .from('restaurant_pending_edits')
      .select('id, status, proposed_changes, created_at, review_notes')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'approved', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(3);
    setPending((data as Pending[]) || []);
  };

  // Per-day check: only a time range or "gesloten" (see src/lib/openingHoursInput.ts).
  const hourErrors = Object.fromEntries(DAYS.map((d) => {
    const v = hours[d.key];
    if (v === undefined || (!v.trim() && DAYS.every((x) => !hours[x.key]?.trim()))) return [d.key, null];
    const r = checkHoursInput(v);
    return [d.key, "error" in r ? r.error : null];
  })) as Record<string, string | null>;
  const hoursValid = DAYS.every((d) => !hourErrors[d.key]);
  const anyHours = DAYS.some((d) => hours[d.key]?.trim());
  const allHours = DAYS.every((d) => hours[d.key]?.trim());
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const tidy = (key: string) => {
    setTouched((t) => ({ ...t, [key]: true }));
    const r = checkHoursInput(hours[key] ?? '');
    if (r.ok) setHours((h) => ({ ...h, [key]: r.value }));
  };

  const submit = async () => {
    if (!user) return;
    if (anyHours && (!allHours || !hoursValid)) {
      setTouched(Object.fromEntries(DAYS.map((d) => [d.key, true])));
      toast.error('Vul elke dag in met een tijd zoals 11:00 - 22:00, of kies Gesloten.');
      return;
    }
    setSaving(true);

    // Opening hours in the required format go live directly (checked again by the database).
    const tidyHours = Object.fromEntries(DAYS.map((d) => {
      const r = checkHoursInput(hours[d.key] ?? '');
      return [d.key, r.ok ? r.value : ''];
    })) as Record<string, string>;
    const currentHours = Object.fromEntries(DAYS.map((d) => [d.key, (currentOpeningHours as Record<string, unknown> | null)?.[d.key] ?? ''])) as Record<string, unknown>;
    const hoursChanged = anyHours && JSON.stringify(tidyHours) !== JSON.stringify(currentHours);
    let hoursSaved = false;
    if (hoursChanged) {
      const { error } = await supabase.rpc('set_restaurant_opening_hours' as never, {
        p_restaurant_id: restaurantId, p_hours: tidyHours,
      } as never);
      if (error) {
        setSaving(false);
        toast.error('Openingstijden opslaan mislukt: ' + error.message);
        return;
      }
      hoursSaved = true;
      setHours(tidyHours);
      onHoursSaved?.(tidyHours);
    }

    // Name and description still go to an admin first.
    const proposed: Record<string, any> = {};
    if (name.trim() && name.trim() !== currentName) proposed.name = name.trim();
    if (descriptionNl.trim() && descriptionNl.trim() !== descriptionOriginal.trim()) proposed.description_nl = descriptionNl.trim();

    if (Object.keys(proposed).length > 0) {
      const { error } = await supabase.from('restaurant_pending_edits').insert({
        restaurant_id: restaurantId,
        submitted_by: user.id,
        proposed_changes: proposed,
        status: 'pending',
      });
      if (error) {
        setSaving(false);
        toast.error((hoursSaved ? 'Openingstijden zijn opgeslagen, maar het indienen van naam of beschrijving mislukte: ' : 'Indienen mislukt: ') + error.message);
        return;
      }
      loadPending();
    }
    setSaving(false);

    if (hoursSaved && Object.keys(proposed).length > 0) {
      toast.success('Openingstijden staan direct live. Naam of beschrijving beoordeelt een admin meestal binnen 1 werkdag.');
    } else if (hoursSaved) {
      toast.success('Openingstijden opgeslagen en direct zichtbaar voor gasten.');
    } else if (Object.keys(proposed).length > 0) {
      toast.success('Ingediend. Een admin beoordeelt je wijziging meestal binnen 1 werkdag.');
    } else {
      toast.info('Geen wijzigingen om op te slaan');
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Openingstijden staan direct live zodra ze kloppen. Een nieuwe naam of beschrijving bekijkt eerst een admin.
        </p>

        {DAYS.every((d) => !hours[d.key]?.trim()) && (
          <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
            <Clock className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <p>
              We missen nog je openingstijden — bezoekers zien nu 'onbekend' in plaats van 'open' of 'gesloten'. Vul dit als eerste in.
            </p>
          </div>
        )}

        <div>
          <Label className="text-xs flex items-center gap-2 mb-2">
            <Clock className="h-3.5 w-3.5" /> Openingstijden: per dag een tijd (bv. 12:00 - 22:00, of 12:00 - 14:30, 17:00 - 22:00) of Gesloten
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {DAYS.map((d) => (
              <div key={d.key} className="space-y-1">
                <div className="flex items-center gap-2">
                  <label htmlFor={`hours-${d.key}`} className="text-xs w-24 text-muted-foreground">{d.label}</label>
                  <Input
                    id={`hours-${d.key}`}
                    className={`flex-1 ${touched[d.key] && hourErrors[d.key] ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    value={hours[d.key] || ''}
                    onChange={(e) => setHours({ ...hours, [d.key]: e.target.value })}
                    onBlur={() => tidy(d.key)}
                    placeholder="12:00 - 22:00"
                    aria-invalid={Boolean(touched[d.key] && hourErrors[d.key])}
                    aria-describedby={`hours-${d.key}-error`}
                  />
                  <Button type="button" size="sm" variant={hours[d.key] === 'gesloten' ? 'secondary' : 'outline'} className="h-9 shrink-0 text-xs"
                    onClick={() => { setHours({ ...hours, [d.key]: 'gesloten' }); setTouched((t) => ({ ...t, [d.key]: true })); }}>
                    Gesloten
                  </Button>
                </div>
                {touched[d.key] && hourErrors[d.key] && (
                  <p id={`hours-${d.key}-error`} className="pl-[104px] text-xs text-destructive">{hourErrors[d.key]}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs">Restaurantnaam</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bv. Bella Napoli" />
        </div>

        <div>
          <Label className="text-xs">Beschrijving (NL)</Label>
          <Textarea
            rows={4}
            value={descriptionNl}
            onChange={(e) => setDescriptionNl(e.target.value)}
            placeholder="Wat maakt jouw restaurant uniek?"
          />
        </div>

        <Button size="sm" onClick={submit} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Opslaan…' : 'Opslaan'}
        </Button>

        {pending.length > 0 && (
          <div className="pt-4 border-t space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Recente indieningen</p>
            {pending.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-2 text-xs p-2 rounded border bg-muted/30">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={p.status === 'approved' ? 'default' : p.status === 'rejected' ? 'destructive' : 'secondary'}
                    >
                      {p.status === 'pending' ? 'In review' : p.status === 'approved' ? 'Goedgekeurd' : 'Afgewezen'}
                    </Badge>
                    <span className="text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString('nl-NL')}
                    </span>
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Velden: {Object.keys(p.proposed_changes || {}).join(', ') || '—'}
                  </div>
                  {p.review_notes && <div className="mt-1 italic">"{p.review_notes}"</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}