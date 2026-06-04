import { useEffect, useState } from 'react';
import { Check, X, ExternalLink, Loader2, Inbox } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Suggestion {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  website: string | null;
  phone: string | null;
  cuisine: string | null;
  notes: string | null;
  suggester_email: string | null;
  status: string;
  created_at: string;
}

export function RestaurantSuggestionsQueue() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurant_suggestions')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });
    if (error) toast.error('Kon suggesties niet ophalen');
    setItems((data || []) as Suggestion[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, [status]);

  const updateStatus = async (id: string, newStatus: 'approved' | 'rejected') => {
    setBusyId(id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('restaurant_suggestions')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id || null,
      })
      .eq('id', id);
    setBusyId(null);
    if (error) {
      toast.error('Update mislukt');
      return;
    }
    toast.success(newStatus === 'approved' ? 'Goedgekeurd' : 'Afgewezen');
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="h-5 w-5" />
          Restaurant suggesties
        </CardTitle>
        <CardDescription>
          Bezoekers kunnen restaurants voorstellen via <code>/suggest-restaurant</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Open</TabsTrigger>
            <TabsTrigger value="approved">Goedgekeurd</TabsTrigger>
            <TabsTrigger value="rejected">Afgewezen</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Geen suggesties in deze categorie.</p>
        ) : (
          <div className="space-y-3">
            {items.map((s) => (
              <div key={s.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[s.address, s.city].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <Badge variant="outline">{new Date(s.created_at).toLocaleDateString('nl-NL')}</Badge>
                </div>
                {s.cuisine && <div className="text-xs">Keuken: <span className="font-medium">{s.cuisine}</span></div>}
                {s.notes && <p className="text-sm text-muted-foreground italic">"{s.notes}"</p>}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {s.website && (
                    <a href={s.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                      <ExternalLink className="h-3 w-3" /> Website
                    </a>
                  )}
                  {s.phone && <span>{s.phone}</span>}
                  {s.suggester_email && <span>via {s.suggester_email}</span>}
                </div>
                {status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => updateStatus(s.id, 'approved')}
                      disabled={busyId === s.id}
                    >
                      <Check className="h-4 w-4 mr-1" /> Goedkeuren
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(s.id, 'rejected')}
                      disabled={busyId === s.id}
                    >
                      <X className="h-4 w-4 mr-1" /> Afwijzen
                    </Button>
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