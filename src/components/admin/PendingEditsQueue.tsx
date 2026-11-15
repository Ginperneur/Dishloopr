import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Check, X, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// apply_pending_edit and checked_at are newer than the generated types.
const db = supabase as unknown as SupabaseClient;

interface Edit {
  id: string;
  created_at: string;
  review_notes: string | null;
  proposed_changes: { name?: string; description_nl?: string };
  restaurant: { name: string; slug: string } | null;
}

/** Owner name/description changes that the automation could not approve on its own. */
export function PendingEditsQueue() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-pending-edits'],
    queryFn: async () => {
      const { data, error } = await db.from('restaurant_pending_edits')
        .select('id, created_at, review_notes, proposed_changes, restaurant:restaurants(name, slug)')
        .eq('status', 'pending').order('created_at').limit(100);
      if (error) throw error;
      return data as unknown as Edit[];
    },
  });

  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    setBusy(id);
    const { error } = await db.rpc('apply_pending_edit', { p_id: id, p_decision: decision, p_note: null });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success(decision === 'approved' ? 'Doorgevoerd' : 'Afgewezen');
    qc.invalidateQueries({ queryKey: ['admin-pending-edits'] });
  };

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (!data.length) return <p className="text-sm text-muted-foreground">Geen wijzigingen die op je wachten. Wat de controle goedkeurt, wordt elk uur vanzelf doorgevoerd.</p>;

  return (
    <div className="space-y-3">
      {data.map(e => (
        <Card key={e.id}>
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <a href={`/restaurant/${e.restaurant?.slug}`} target="_blank" rel="noreferrer" className="font-semibold hover:underline">{e.restaurant?.name}</a>
              <span className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString('nl-NL')}</span>
            </div>
            {e.proposed_changes.name && <p className="text-sm"><span className="text-muted-foreground">Nieuwe naam:</span> {e.proposed_changes.name}</p>}
            {e.proposed_changes.description_nl && <p className="whitespace-pre-line text-sm"><span className="text-muted-foreground">Nieuwe beschrijving:</span> {e.proposed_changes.description_nl}</p>}
            {e.review_notes && <p className="rounded bg-muted p-2 text-xs">Controle: {e.review_notes}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => decide(e.id, 'approved')} disabled={busy === e.id}><Check className="mr-1 h-4 w-4" />Doorvoeren</Button>
              <Button size="sm" variant="outline" onClick={() => decide(e.id, 'rejected')} disabled={busy === e.id}><X className="mr-1 h-4 w-4" />Afwijzen</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
