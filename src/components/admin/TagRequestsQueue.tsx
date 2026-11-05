import { useEffect, useState } from 'react';
import { Check, X, Loader2, Inbox, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Request {
  id: string;
  restaurant_id: string;
  tag_type: 'cuisine' | 'ambience' | 'concept';
  tag_value: string;
  note: string | null;
  status: string;
  created_at: string;
  restaurant?: { name: string; slug: string } | null;
}

const COLUMN_BY_TYPE: Record<Request['tag_type'], 'cuisines' | 'ambience_tags' | 'concepts'> = {
  cuisine: 'cuisines',
  ambience: 'ambience_tags',
  concept: 'concepts',
};

const TAG_TYPE_LABELS: Record<string, string> = {
  cuisine: 'Keuken',
  ambience: 'Sfeer',
  concept: 'Concept',
};

export function TagRequestsQueue() {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [items, setItems] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurant_tag_requests')
      .select('id, restaurant_id, tag_type, tag_value, note, status, created_at, restaurant:restaurants(name, slug)')
      .eq('status', status)
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Kon tag-aanvragen niet ophalen');
      setLoading(false);
      return;
    }
    setItems((data || []) as unknown as Request[]);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [status]);

  const approve = async (req: Request) => {
    setBusyId(req.id);
    const column = COLUMN_BY_TYPE[req.tag_type];

    // Read current array, append if not already present, write back —
    // then mark the request approved. Two steps, but this table has no
    // array_append RPC exposed to the client.
    const { data: restaurant, error: fetchErr } = await supabase
      .from('restaurants')
      .select(column)
      .eq('id', req.restaurant_id)
      .single();
    if (fetchErr || !restaurant) {
      toast.error('Kon restaurant niet ophalen');
      setBusyId(null);
      return;
    }
    const current: string[] = (restaurant as any)[column] || [];
    if (!current.includes(req.tag_value)) {
      const { error: updateErr } = await supabase
        .from('restaurants')
        .update({ [column]: [...current, req.tag_value] })
        .eq('id', req.restaurant_id);
      if (updateErr) {
        toast.error('Kon tag niet toevoegen aan restaurant');
        setBusyId(null);
        return;
      }
    }

    const { error } = await supabase
      .from('restaurant_tag_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq('id', req.id);
    setBusyId(null);
    if (error) {
      toast.error('Kon aanvraag niet goedkeuren');
      return;
    }
    toast.success(`"${req.tag_value}" toegevoegd aan ${req.restaurant?.name}`);
    setItems(prev => prev.filter(i => i.id !== req.id));
  };

  const reject = async (req: Request) => {
    setBusyId(req.id);
    const { error } = await supabase
      .from('restaurant_tag_requests')
      .update({
        status: 'rejected',
        admin_notes: notes[req.id] || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .eq('id', req.id);
    setBusyId(null);
    if (error) {
      toast.error('Kon aanvraag niet afwijzen');
      return;
    }
    toast.success('Aanvraag afgewezen');
    setItems(prev => prev.filter(i => i.id !== req.id));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-3">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Tag-aanvragen
          </CardTitle>
          <CardDescription>Door eigenaren aangevraagde keuken-, sfeer- of conceptlabels.</CardDescription>
        </div>
        <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <TabsList>
            <TabsTrigger value="pending">In behandeling</TabsTrigger>
            <TabsTrigger value="approved">Goedgekeurd</TabsTrigger>
            <TabsTrigger value="rejected">Afgewezen</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Laden…
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>Niets hier</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map(req => (
              <div key={req.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-start gap-3 justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">{TAG_TYPE_LABELS[req.tag_type]}</Badge>
                    <span className="font-medium text-sm">{req.tag_value}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {req.restaurant?.name || '(onbekend restaurant)'}
                  </p>
                  {req.note && <p className="text-sm mt-1">{req.note}</p>}
                </div>
                {status === 'pending' && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <Input
                      placeholder="Reden bij afwijzen (optioneel)"
                      value={notes[req.id] || ''}
                      onChange={(e) => setNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                      className="h-8 text-xs w-full sm:w-48"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => approve(req)} disabled={busyId === req.id}>
                        <Check className="w-4 h-4 mr-1" /> Goedkeuren
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => reject(req)} disabled={busyId === req.id}>
                        <X className="w-4 h-4 mr-1" /> Afwijzen
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
