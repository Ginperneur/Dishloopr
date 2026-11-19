import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

type Visit = { id: string; restaurant_id: string; status: string; owner_note: string | null; feedback: string | null; admin_note: string | null;
  visited_on: string | null; created_at: string; restaurant: { name: string; slug: string; city: { name: string } | null } | null };
const STATUS = { requested: 'Aangevraagd', planned: 'Ingepland', visited: 'Bezocht', approved: 'Goedgekeurd', rejected: 'Afgewezen', withdrawn: 'Ingetrokken' } as const;
const db = supabase as unknown as { from: (t: string) => any };

/** Test visit requests for "Getest door Dishloopr". Approve, then add the restaurant to a collection with its test date. */
export function TestVisitsManager() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const { data: visits = [], isLoading } = useQuery({
    queryKey: ['admin-test-visits', filter],
    queryFn: async () => {
      let q = db.from('test_visit_requests').select('*, restaurant:restaurant_id(name, slug, city:city_id(name))').order('created_at', { ascending: true }).limit(200);
      if (filter === 'open') q = q.in('status', ['requested', 'planned', 'visited']);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Visit[];
    },
  });
  const save = async (v: Visit, patch: Partial<Visit>) => {
    const decided = patch.status === 'approved' || patch.status === 'rejected';
    const { error } = await db.from('test_visit_requests').update({ ...patch, ...(decided ? { decided_at: new Date().toISOString() } : {}), updated_at: new Date().toISOString() }).eq('id', v.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Opgeslagen');
    qc.invalidateQueries({ queryKey: ['admin-test-visits'] });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Testbezoeken</CardTitle>
        <CardDescription>Gratis aanvragen van eigenaren, twee per jaar. Ga onaangekondigd langs en betaal zelf. Goedgekeurd? Zet het restaurant in een collectie met de testdatum, dan verschijnt het in "Getest door Dishloopr" (vanaf 3 per stad).</CardDescription>
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant={filter === 'open' ? 'default' : 'outline'} onClick={() => setFilter('open')}>Open</Button>
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>Alles</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? <p className="text-sm text-muted-foreground">Laden…</p> : !visits.length ? <p className="text-sm text-muted-foreground">Geen aanvragen.</p> : visits.map(v => (
          <VisitRow key={v.id} v={v} onSave={patch => save(v, patch)} />
        ))}
        <p className="text-xs text-muted-foreground">Collecties beheer je onder <Link to="/admin?section=collections" className="underline">Collecties</Link>.</p>
      </CardContent>
    </Card>
  );
}

function VisitRow({ v, onSave }: { v: Visit; onSave: (patch: Partial<Visit>) => void }) {
  const [feedback, setFeedback] = useState(v.feedback ?? '');
  const [note, setNote] = useState(v.admin_note ?? '');
  const [day, setDay] = useState(v.visited_on ?? '');
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/restaurant/${v.restaurant?.slug}`} className="font-medium hover:underline">{v.restaurant?.name ?? 'Restaurant'}</Link>
        <span className="text-sm text-muted-foreground">{v.restaurant?.city?.name}</span>
        <Badge variant="secondary">{STATUS[v.status as keyof typeof STATUS] ?? v.status}</Badge>
        <span className="ml-auto text-xs text-muted-foreground">Aangevraagd {new Date(v.created_at).toLocaleDateString('nl-NL')}</span>
      </div>
      {v.owner_note && <p className="text-sm">Eigenaar: {v.owner_note}</p>}
      <div className="grid gap-2 md:grid-cols-2">
        <Textarea rows={2} placeholder="Feedback voor de eigenaar (zichtbaar voor hen)" value={feedback} onChange={e => setFeedback(e.target.value)} />
        <Textarea rows={2} placeholder="Interne notitie" value={note} onChange={e => setNote(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" aria-label="Bezocht op" value={day} onChange={e => setDay(e.target.value)} className="h-9 w-auto" />
        <Button size="sm" variant="outline" onClick={() => onSave({ status: 'planned', feedback, admin_note: note })}>Ingepland</Button>
        <Button size="sm" variant="outline" onClick={() => onSave({ status: 'visited', visited_on: day || null, feedback, admin_note: note })}>Bezocht</Button>
        <Button size="sm" onClick={() => onSave({ status: 'approved', visited_on: day || null, feedback, admin_note: note })}>Goedkeuren</Button>
        <Button size="sm" variant="destructive" onClick={() => onSave({ status: 'rejected', visited_on: day || null, feedback, admin_note: note })}>Afwijzen</Button>
      </div>
    </div>
  );
}
