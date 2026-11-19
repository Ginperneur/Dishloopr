import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

type Visit = { id: string; status: string; feedback: string | null; visited_on: string | null; created_at: string; decided_at: string | null };
const STATUS: Record<string, string> = {
  requested: 'Aangevraagd', planned: 'Ingepland', visited: 'Bezocht, we beoordelen nog', approved: 'Goedgekeurd: je staat in Getest door Dishloopr',
  rejected: 'Niet opgenomen', withdrawn: 'Ingetrokken',
};

/** Ask for a test visit for "Getest door Dishloopr": free, twice a year, no promise of a place. */
export function TestVisitRequest({ restaurantId }: { restaurantId: string }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: visits = [], refetch } = useQuery({
    queryKey: ['test-visits', restaurantId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('my_test_visits', { p_restaurant: restaurantId });
      if (error) throw error;
      return (data ?? []) as Visit[];
    },
  });
  const open = visits.find(v => ['requested', 'planned', 'visited'].includes(v.status));
  const ask = async () => {
    setBusy(true);
    const { error } = await (supabase.rpc as any)('request_test_visit', { p_restaurant: restaurantId, p_note: note });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Aanvraag ontvangen. We komen onaangekondigd langs, meestal binnen 6 weken.');
    setNote('');
    refetch();
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        In "Getest door Dishloopr" staan restaurants waar we zelf zijn gaan eten. We betalen de rekening en komen onaangekondigd.
        Een aanvraag is gratis en geeft geen garantie op een plek. Je kunt twee keer per jaar aanvragen; na een afwijzing kan het weer na 6 maanden.
        Dit staat los van betaalde plekken en is niet te koop.
      </p>
      {visits.length > 0 && (
        <ul className="space-y-2">
          {visits.map(v => (
            <li key={v.id} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{STATUS[v.status] ?? v.status}</p>
              <p className="text-xs text-muted-foreground">Aangevraagd op {new Date(v.created_at).toLocaleDateString('nl-NL')}{v.visited_on ? `, bezocht op ${new Date(v.visited_on).toLocaleDateString('nl-NL')}` : ''}</p>
              {v.feedback && <p className="mt-2">{v.feedback}</p>}
            </li>
          ))}
        </ul>
      )}
      {!open && (
        <div className="space-y-2">
          <Label htmlFor="tv-note">Iets dat we moeten weten? (optioneel)</Label>
          <Textarea id="tv-note" rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="Bijvoorbeeld: onze nieuwe kaart staat vanaf 1 december." />
          <Button className="min-h-11" disabled={busy} onClick={ask}>Vraag een testbezoek aan</Button>
        </div>
      )}
    </div>
  );
}
