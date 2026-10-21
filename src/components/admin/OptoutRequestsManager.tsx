import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Req = {
  id: string; restaurant_naam: string | null; website: string | null; email: string | null;
  naam_aanvrager: string | null; soort: string | null; toelichting: string | null;
  status: string | null; admin_notitie: string | null; created_at: string;
};
const SOORT: Record<string, string> = { geen_mail: 'Geen mail', verwijderen: 'Verwijderen', gegevens_aanpassen: 'Aanpassen' };
const STATUSES = ['nieuw', 'in_behandeling', 'afgehandeld', 'afgewezen'];

export function OptoutRequestsManager() {
  const [rows, setRows] = useState<Req[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const db = supabase as unknown as { from: (t: string) => any };

  const load = async () => {
    const { data, error } = await db.from('restaurant_optout_requests').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) toast.error('Laden mislukt'); else setRows(data as Req[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const update = async (id: string, patch: Partial<Req> & { afgehandeld_op?: string | null }) => {
    const { error } = await db.from('restaurant_optout_requests').update(patch).eq('id', id);
    if (error) toast.error('Opslaan mislukt'); else { toast.success('Opgeslagen'); load(); }
  };

  if (loading) return <p className="text-muted-foreground">Laden…</p>;
  if (!rows.length) return <p className="text-muted-foreground">Nog geen afmeldingen.</p>;
  return (
    <div className="space-y-3">
      {rows.map(r => (
        <div key={r.id} className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <p className="font-semibold">{r.restaurant_naam} <span className="text-xs text-muted-foreground">· {SOORT[r.soort ?? ''] ?? r.soort}</span></p>
              <p className="text-sm text-muted-foreground">{r.naam_aanvrager} · {r.email}{r.website ? ` · ${r.website}` : ''} · {new Date(r.created_at).toLocaleDateString('nl-NL')}</p>
            </div>
            <Select value={r.status ?? 'nieuw'} onValueChange={(v) => update(r.id, { status: v, afgehandeld_op: v === 'afgehandeld' || v === 'afgewezen' ? new Date().toISOString() : null })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {r.toelichting && <p className="text-sm">{r.toelichting}</p>}
          <div className="flex gap-2">
            <Textarea rows={2} placeholder="Admin-notitie" value={notes[r.id] ?? r.admin_notitie ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
            <Button variant="outline" onClick={() => update(r.id, { admin_notitie: notes[r.id] ?? r.admin_notitie })}>Opslaan</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
