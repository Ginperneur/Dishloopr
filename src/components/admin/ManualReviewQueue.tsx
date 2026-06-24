import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { AlertTriangle, ExternalLink, Check, RefreshCw } from 'lucide-react';

interface Row {
  id: string;
  name: string;
  slug: string;
  city_name: string | null;
  review_status: string | null;
  cuisine_primary: string | null;
  ambience_clean: string | null;
  concept_clean: string | null;
  meal_types_clean: string | null;
  google_status: string | null;
  google_rating: number | null;
  is_active: boolean;
  verified_at: string | null;
}

export function ManualReviewQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('restaurants')
      .select('id,name,slug,review_status,cuisine_primary,ambience_clean,concept_clean,meal_types_clean,google_status,google_rating,is_active,verified_at,cities:city_id(name)')
      .eq('needs_manual_review', true)
      .order('name', { ascending: true })
      .limit(1000);
    if (error) {
      toast.error('Kon lijst niet laden');
      setLoading(false);
      return;
    }
    setRows(
      (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        slug: r.slug,
        city_name: r.cities?.name ?? null,
        review_status: r.review_status,
        cuisine_primary: r.cuisine_primary,
        ambience_clean: r.ambience_clean,
        concept_clean: r.concept_clean,
        meal_types_clean: r.meal_types_clean,
        google_status: r.google_status,
        google_rating: r.google_rating,
        is_active: r.is_active,
        verified_at: r.verified_at,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const markReviewed = async (ids: string[]) => {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from('restaurants')
      .update({ needs_manual_review: false, verified_at: new Date().toISOString().slice(0, 10) })
      .in('id', ids);
    if (error) {
      toast.error('Bijwerken mislukt');
      return;
    }
    toast.success(`${ids.length} restaurant(s) gemarkeerd als nagekeken`);
    setSelected(new Set());
    load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Handmatig nakijken ({rows.length})
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" disabled={selected.size === 0} onClick={() => markReviewed([...selected])}>
            <Check className="h-4 w-4 mr-1" /> Markeer nagekeken ({selected.size})
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen restaurants in de wachtrij.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground border-b">
                <tr>
                  <th className="py-2 w-8"></th>
                  <th className="py-2">Naam</th>
                  <th className="py-2">Stad</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Keuken</th>
                  <th className="py-2">Sfeer</th>
                  <th className="py-2">Concept</th>
                  <th className="py-2">Maaltijd</th>
                  <th className="py-2">Google</th>
                  <th className="py-2 w-12"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/40">
                    <td className="py-2">
                      <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                    </td>
                    <td className="py-2 font-medium">
                      {r.name}
                      {!r.is_active && <Badge variant="secondary" className="ml-2 text-[10px]">inactief</Badge>}
                    </td>
                    <td className="py-2 text-muted-foreground">{r.city_name || '—'}</td>
                    <td className="py-2">
                      {r.review_status ? <Badge variant="outline" className="text-[10px]">{r.review_status}</Badge> : '—'}
                    </td>
                    <td className="py-2">{r.cuisine_primary || '—'}</td>
                    <td className="py-2">{r.ambience_clean || '—'}</td>
                    <td className="py-2">{r.concept_clean || '—'}</td>
                    <td className="py-2">{r.meal_types_clean || '—'}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {r.google_status || '—'}{r.google_rating ? ` · ${r.google_rating}★` : ''}
                    </td>
                    <td className="py-2">
                      <Link to={`/restaurant/${r.slug}`} target="_blank" className="text-primary inline-flex">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}