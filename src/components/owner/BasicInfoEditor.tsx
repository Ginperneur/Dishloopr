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
}

type Pending = {
  id: string;
  status: string;
  proposed_changes: any;
  created_at: string;
  review_notes: string | null;
};

export function BasicInfoEditor({ restaurantId, currentName, currentOpeningHours }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState(currentName || '');
  const [descriptionNl, setDescriptionNl] = useState('');
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

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    const proposed: Record<string, any> = {};
    if (name.trim() && name.trim() !== currentName) proposed.name = name.trim();
    if (Object.keys(hours).length > 0) proposed.opening_hours = hours;
    if (descriptionNl.trim()) proposed.description_nl = descriptionNl.trim();

    if (Object.keys(proposed).length === 0) {
      toast.info('Geen wijzigingen om in te dienen');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('restaurant_pending_edits').insert({
      restaurant_id: restaurantId,
      submitted_by: user.id,
      proposed_changes: proposed,
      status: 'pending',
    });
    setSaving(false);
    if (error) {
      toast.error('Indienen mislukt: ' + error.message);
      return;
    }
    toast.success('Wijzigingen ingediend — een admin beoordeelt ze meestal binnen 1 werkdag.');
    loadPending();
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Wijzigingen aan naam, beschrijving en openingstijden worden ter goedkeuring aan een admin voorgelegd.
        </p>

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

        <div>
          <Label className="text-xs flex items-center gap-2 mb-2">
            <Clock className="h-3.5 w-3.5" /> Openingstijden (per dag, bv. "12:00 - 22:00" of "gesloten")
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {DAYS.map((d) => (
              <div key={d.key} className="flex items-center gap-2">
                <span className="text-xs w-24 text-muted-foreground">{d.label}</span>
                <Input
                  className="flex-1"
                  value={hours[d.key] || ''}
                  onChange={(e) => setHours({ ...hours, [d.key]: e.target.value })}
                  placeholder="12:00 - 22:00"
                />
              </div>
            ))}
          </div>
        </div>

        <Button size="sm" onClick={submit} disabled={saving}>
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Indienen…' : 'Wijzigingen indienen'}
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