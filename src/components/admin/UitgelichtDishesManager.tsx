import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Crown, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

// uitgelicht_dishes is newer than the generated types.
const db = supabase as unknown as SupabaseClient;

interface Row { dish_slug: string; enabled: boolean }

/** Which dishes may carry Uitgelicht places (pages also need at least 6 restaurants). */
export function UitgelichtDishesManager() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const { data: rows = [] } = useQuery({
    queryKey: ['uitgelicht-dishes'],
    queryFn: async () => ((await db.from('uitgelicht_dishes').select('dish_slug, enabled').order('dish_slug')).data ?? []) as Row[],
  });
  const { data: names = new Map<string, string>() } = useQuery({
    queryKey: ['uitgelicht-dish-names', rows.map(r => r.dish_slug).join()],
    enabled: rows.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('dishes').select('slug, name').in('slug', rows.map(r => r.dish_slug));
      return new Map((data ?? []).map(d => [d.slug, d.name]));
    },
  });
  const { data: candidates = [] } = useQuery({
    queryKey: ['uitgelicht-candidates', query],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const { data } = await supabase.from('dishes').select('slug, name, canonical_slug').ilike('name', `%${query.trim()}%`).limit(20);
      // Only main dishes (the slug a dish page uses).
      return (data ?? []).filter(d => !d.canonical_slug || d.canonical_slug === d.slug);
    },
  });
  const listed = useMemo(() => new Set(rows.map(r => r.dish_slug)), [rows]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['uitgelicht-dishes'] });

  const toggle = async (slug: string, enabled: boolean) => {
    const { error } = await db.from('uitgelicht_dishes').update({ enabled, updated_at: new Date().toISOString() }).eq('dish_slug', slug);
    if (error) toast.error(error.message); else refresh();
  };
  const add = async (slug: string) => {
    const { error } = await db.from('uitgelicht_dishes').insert({ dish_slug: slug });
    if (error) toast.error(error.message); else { toast.success('Toegevoegd'); setQuery(''); refresh(); }
  };
  const remove = async (slug: string) => {
    const { error } = await db.from('uitgelicht_dishes').delete().eq('dish_slug', slug);
    if (error) toast.error(error.message); else refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Crown className="h-5 w-5 text-primary" />Uitgelicht-gerechten</CardTitle>
        <CardDescription>
          Alleen op gerechtpagina's van deze gerechten, met minstens 6 restaurants, kunnen restaurants Uitgelicht kopen. Alle pagina's blijven online;
          bestaande plekken blijven lopen als je een gerecht uitzet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input placeholder="Gerecht toevoegen, typ een naam" value={query} onChange={e => setQuery(e.target.value)} className="min-h-11" />
          {candidates.filter(c => !listed.has(c.slug)).slice(0, 8).map(c => (
            <Button key={c.slug} size="sm" variant="outline" className="mr-2" onClick={() => add(c.slug)}><Plus className="mr-1 h-3 w-3" />{c.name}</Button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map(r => (
            <div key={r.dish_slug} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm">
              <span className={r.enabled ? '' : 'text-muted-foreground line-through'}>{names.get(r.dish_slug) ?? r.dish_slug}</span>
              <div className="flex items-center gap-1">
                <Switch checked={r.enabled} onCheckedChange={v => toggle(r.dish_slug, v)} aria-label={`Uitgelicht voor ${r.dish_slug}`} />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(r.dish_slug)} aria-label="Verwijderen"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
