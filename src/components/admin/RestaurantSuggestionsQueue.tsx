import { useEffect, useState } from 'react';
import { Check, X, ExternalLink, Loader2, Inbox, Plus, RotateCcw, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { slugify } from '@/lib/utils';

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
  admin_notes?: string | null;
}

export function RestaurantSuggestionsQueue() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const fetchCounts = async () => {
    const statuses: Array<'pending' | 'approved' | 'rejected'> = ['pending', 'approved', 'rejected'];
    const results = await Promise.all(
      statuses.map((s) =>
        supabase
          .from('restaurant_suggestions')
          .select('id', { count: 'exact', head: true })
          .eq('status', s)
      )
    );
    setCounts({
      pending: results[0].count || 0,
      approved: results[1].count || 0,
      rejected: results[2].count || 0,
    });
  };

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
    fetchCounts();
  }, [status]);

  const updateStatus = async (
    id: string,
    newStatus: 'pending' | 'approved' | 'rejected'
  ) => {
    setBusyId(id);
    const { data: { user } } = await supabase.auth.getUser();
    const adminNotes = noteDrafts[id];
    const { error } = await supabase
      .from('restaurant_suggestions')
      .update({
        status: newStatus,
        reviewed_at: newStatus === 'pending' ? null : new Date().toISOString(),
        reviewed_by: newStatus === 'pending' ? null : user?.id || null,
        ...(adminNotes !== undefined ? { admin_notes: adminNotes } : {}),
      })
      .eq('id', id);
    setBusyId(null);
    if (error) {
      toast.error('Update mislukt');
      return;
    }
    toast.success(
      newStatus === 'approved'
        ? 'Goedgekeurd'
        : newStatus === 'rejected'
        ? 'Afgewezen'
        : 'Teruggezet naar open'
    );
    setItems((prev) => prev.filter((i) => i.id !== id));
    fetchCounts();
  };

  const createRestaurantFromSuggestion = async (s: Suggestion) => {
    if (!s.address || !s.city) {
      toast.error('Adres en stad zijn verplicht om een restaurant aan te maken');
      return;
    }
    setBusyId(s.id);
    try {
      // Resolve city by case-insensitive name match
      const { data: cityRow } = await supabase
        .from('cities')
        .select('id')
        .ilike('name', s.city.trim())
        .maybeSingle();

      if (!cityRow?.id) {
        toast.error(`Stad "${s.city}" niet gevonden — voeg deze eerst toe in Steden-beheer.`);
        return;
      }

      const baseSlug = slugify(`${s.name}-${s.city}`);
      // Ensure slug uniqueness with a short random suffix if needed
      let finalSlug = baseSlug;
      const { data: existing } = await supabase
        .from('restaurants')
        .select('id')
        .eq('slug', baseSlug)
        .maybeSingle();
      if (existing) finalSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

      const { data: created, error: insertErr } = await supabase
        .from('restaurants')
        .insert({
          name: s.name,
          slug: finalSlug,
          city_id: cityRow.id,
          address: s.address,
          phone: s.phone,
          website_url: s.website,
          cuisines: s.cuisine ? [s.cuisine] : [],
          is_active: false, // hidden until enriched / claimed
        })
        .select('id, slug')
        .single();

      if (insertErr || !created) {
        toast.error(insertErr?.message || 'Aanmaken mislukt');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from('restaurant_suggestions')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id || null,
          admin_notes: `Aangemaakt als restaurant ${created.id} — ${noteDrafts[s.id] || ''}`.trim(),
        })
        .eq('id', s.id);

      toast.success('Restaurant aangemaakt (inactief — wacht op verrijking)');
      setItems((prev) => prev.filter((i) => i.id !== s.id));
      fetchCounts();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="h-5 w-5" />
          Restaurant suggesties
          {counts.pending > 0 && (
            <Badge variant="default" className="ml-1">{counts.pending}</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Bezoekers kunnen restaurants voorstellen via <code>/suggest-restaurant</code>.
          Keur goed om als nieuw (inactief) restaurant aan te maken, of wijs af met een toelichting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Open ({counts.pending})</TabsTrigger>
            <TabsTrigger value="approved">Goedgekeurd ({counts.approved})</TabsTrigger>
            <TabsTrigger value="rejected">Afgewezen ({counts.rejected})</TabsTrigger>
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
                {s.admin_notes && (
                  <div className="text-xs bg-muted/40 rounded p-2">
                    <span className="font-medium">Admin notitie: </span>
                    {s.admin_notes}
                  </div>
                )}
                {status === 'pending' && (
                  <Textarea
                    value={noteDrafts[s.id] ?? ''}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))
                    }
                    placeholder="Admin-notitie (optioneel) — reden voor afwijzing of context bij aanmaken"
                    className="text-xs"
                    rows={2}
                  />
                )}
                {status === 'pending' && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => createRestaurantFromSuggestion(s)}
                      disabled={busyId === s.id}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Goedkeuren & aanmaken
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => updateStatus(s.id, 'approved')}
                      disabled={busyId === s.id}
                      title="Goedkeuren zonder restaurant aan te maken"
                    >
                      <Check className="h-4 w-4 mr-1" /> Alleen goedkeuren
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
                {status !== 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateStatus(s.id, 'pending')}
                      disabled={busyId === s.id}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" /> Terug naar open
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