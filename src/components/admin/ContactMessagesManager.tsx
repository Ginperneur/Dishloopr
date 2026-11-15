import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Loader2, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CONTACT_CATEGORIES, CONTACT_STATUS_LABEL, type ContactMessage } from '@/lib/contactMessages';

const db = supabase as unknown as SupabaseClient;
type Row = ContactMessage & { restaurant?: { name: string; slug: string } | null };

/** Admin inbox for the /contact form and the owners' "Hulp en contact" messages. */
export function ContactMessagesManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = db.from('contact_messages')
      .select('*, restaurant:restaurants(name, slug)')
      .order('created_at', { ascending: false }).limit(200);
    if (filter === 'open') q = q.in('status', ['nieuw', 'in_behandeling']);
    else if (filter !== 'alle') q = q.eq('status', filter);
    const { data, error } = await q;
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as Row[]);
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  const update = async (id: string, patch: Partial<ContactMessage>) => {
    const full = patch.status === 'afgehandeld' ? { ...patch, handled_at: new Date().toISOString() } : patch;
    const { error } = await db.from('contact_messages').update(full).eq('id', id);
    if (error) { toast.error(error.message); return; }
    setRows(r => r.map(x => (x.id === id ? { ...x, ...full } : x)));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[['open', 'Open'], ['nieuw', 'Nieuw'], ['in_behandeling', 'In behandeling'], ['afgehandeld', 'Afgehandeld'], ['alle', 'Alle']].map(([id, label]) => (
          <Button key={id} size="sm" variant={filter === id ? 'default' : 'outline'} onClick={() => setFilter(id)}>{label}</Button>
        ))}
        <Button size="sm" variant="ghost" onClick={load} aria-label="Vernieuwen"><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {!loading && rows.length === 0 && <p className="text-sm text-muted-foreground">Geen berichten in deze lijst.</p>}
      {rows.map(r => (
        <Card key={r.id}>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{r.subject}</span>
              <Badge variant="outline">{CONTACT_CATEGORIES.find(c => c.id === r.category)?.label ?? 'Contactformulier'}</Badge>
              {r.restaurant && <Badge variant="secondary">{r.restaurant.name}</Badge>}
              <span className="text-xs text-muted-foreground">{r.name} · {r.email} · {new Date(r.created_at).toLocaleString('nl-NL')}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{r.message}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={r.status} onValueChange={v => update(r.id, { status: v })}>
                <SelectTrigger className="h-9 w-44" aria-label="Status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTACT_STATUS_LABEL).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button asChild size="sm" variant="outline">
                <a href={`mailto:${r.email}?subject=${encodeURIComponent(`Re: ${r.subject}`)}`}><Mail className="mr-2 h-4 w-4" />Antwoorden per mail</a>
              </Button>
            </div>
            <Textarea rows={2} defaultValue={r.admin_notes ?? ''} placeholder="Interne notitie (alleen voor admins)"
              onBlur={e => { if ((e.target.value || null) !== (r.admin_notes ?? null)) void update(r.id, { admin_notes: e.target.value || null }); }} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
