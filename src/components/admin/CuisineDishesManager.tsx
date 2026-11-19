import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Row = { cuisine: string; dish_slug: string };
const db = supabase as unknown as { from: (t: string) => any };

/** Which dishes make a cuisine for the cuisine pages: 3 of them on a restaurant's menu give it that cuisine. */
export function CuisineDishesManager() {
  const qc = useQueryClient();
  const [cuisine, setCuisine] = useState('');
  const [slug, setSlug] = useState('');
  const { data: rows = [] } = useQuery({
    queryKey: ['cuisine-dishes'],
    queryFn: async () => {
      const { data, error } = await db.from('cuisine_dishes').select('cuisine, dish_slug').order('cuisine').order('dish_slug');
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['cuisine-dishes'] });
  const add = async () => {
    const c = cuisine.trim(); const s = slug.trim().toLowerCase();
    if (!c || !s) return;
    const { error } = await db.from('cuisine_dishes').insert({ cuisine: c, dish_slug: s });
    if (error) { toast.error(error.message); return; }
    setSlug(''); refresh();
  };
  const remove = async (r: Row) => {
    const { error } = await db.from('cuisine_dishes').delete().eq('cuisine', r.cuisine).eq('dish_slug', r.dish_slug);
    if (error) { toast.error(error.message); return; }
    refresh();
  };
  const groups = [...new Set(rows.map(r => r.cuisine))];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Keukens</CardTitle>
        <CardDescription>Een restaurant hoort bij een keuken als minstens 3 van zijn goedgekeurde gerechten bij die keuken horen (op canonieke slug of gerechtgroep), of als de keuken is ingevuld en niet gekocht. Keukenpagina's komen er elke nacht bij vanaf 6 restaurants in een stad.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Keuken" list="cuisine-list" placeholder="Keuken, bijv. Italiaans" value={cuisine} onChange={e => setCuisine(e.target.value)} className="w-48" />
          <datalist id="cuisine-list">{groups.map(g => <option key={g} value={g} />)}</datalist>
          <Input aria-label="Gerecht-slug" placeholder="gerecht-slug, bijv. gnocchi" value={slug} onChange={e => setSlug(e.target.value)} className="w-56" />
          <Button onClick={add} disabled={!cuisine.trim() || !slug.trim()}>Toevoegen</Button>
        </div>
        {groups.map(g => (
          <div key={g} className="space-y-1.5">
            <p className="text-sm font-semibold">{g}</p>
            <div className="flex flex-wrap gap-1.5">
              {rows.filter(r => r.cuisine === g).map(r => (
                <span key={r.dish_slug} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs">
                  {r.dish_slug}
                  <button type="button" aria-label={`${r.dish_slug} verwijderen`} onClick={() => remove(r)}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
