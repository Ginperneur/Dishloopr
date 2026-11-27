import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Req = {
  id: string; restaurant_naam: string | null; website: string | null; email: string | null;
  naam_aanvrager: string | null; soort: string | null; toelichting: string | null;
  status: string | null; admin_notitie: string | null; created_at: string;
  restaurant_id: string | null; outreach_reply_id: string | null;
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

  // One action for a removal request: hide the restaurant for good, wipe its contact details and close
  // the request (admin_remove_restaurant_on_request). Without a linked restaurant, paste its slug or URL.
  const [slugs, setSlugs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const removeRestaurant = async (r: Req) => {
    let restaurantId = r.restaurant_id;
    let name = r.restaurant_naam ?? 'dit restaurant';
    if (!restaurantId) {
      const slug = (slugs[r.id] ?? '').trim().replace(/^.*\/restaurant\//, '').replace(/[/?#].*$/, '');
      if (!slug) { toast.error('Plak eerst de slug of de URL van de restaurantpagina'); return; }
      const { data } = await db.from('restaurants').select('id, name').eq('slug', slug).maybeSingle();
      if (!data) { toast.error(`Geen restaurant gevonden met slug ${slug}`); return; }
      restaurantId = data.id; name = data.name;
    }
    if (!window.confirm(`${name} verwijderen op verzoek?\n\nDe pagina gaat offline en blijft offline, de contactgegevens worden gewist en dit restaurant wordt nooit meer gemaild. Het verzoek wordt afgehandeld.`)) return;
    setBusy(r.id);
    const { error } = await (supabase.rpc as unknown as (f: string, a: object) => Promise<{ error: { message: string } | null }>)(
      'admin_remove_restaurant_on_request', { p_request_id: r.id, p_restaurant_id: restaurantId },
    );
    setBusy(null);
    if (error) toast.error(error.message); else { toast.success(`${name} is verwijderd. Stuur de aanvrager nog een bevestiging.`); load(); }
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
          {r.outreach_reply_id && <p className="text-xs text-muted-foreground">Binnengekomen als antwoord in Outreach; stuur daar de bevestiging.</p>}
          {r.soort === 'verwijderen' && r.status !== 'afgehandeld' && r.status !== 'afgewezen' && (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/50 p-2">
              {!r.restaurant_id && (
                <Input className="h-9 w-72" placeholder="Slug of URL van de restaurantpagina" value={slugs[r.id] ?? ''}
                  onChange={(e) => setSlugs({ ...slugs, [r.id]: e.target.value })} />
              )}
              <Button variant="destructive" size="sm" disabled={busy === r.id} onClick={() => removeRestaurant(r)}>
                {busy === r.id ? 'Bezig…' : 'Verwijderen op verzoek'}
              </Button>
              <span className="text-xs text-muted-foreground">Pagina offline, contactgegevens gewist, nooit meer mailen.</span>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea rows={2} placeholder="Admin-notitie" value={notes[r.id] ?? r.admin_notitie ?? ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
            <Button variant="outline" onClick={() => update(r.id, { admin_notitie: notes[r.id] ?? r.admin_notitie })}>Opslaan</Button>
          </div>
        </div>
      ))}
    </div>
  );
}
