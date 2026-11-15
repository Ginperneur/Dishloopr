import { useEffect, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

/** Shown while a claimed restaurant is hidden for an incomplete menu; it goes live by itself at the minimum. */
export function OwnerHiddenNotice({ slug, onAddMenu }: { slug: string; onAddMenu: () => void }) {
  const [counts, setCounts] = useState<{ menu_count: number; menu_minimum: number } | null>(null);
  useEffect(() => {
    supabase.rpc('claimable_restaurant' as never, { p_slug: slug } as never).then(({ data }) => {
      const row = (data as unknown as { menu_count: number; menu_minimum: number }[] | null)?.[0];
      setCounts(row ?? null);
    });
  }, [slug]);
  if (!counts) return null;
  const missing = Math.max(0, counts.menu_minimum - counts.menu_count);
  return (
    <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5" aria-labelledby="hidden-notice">
      <h2 id="hidden-notice" className="flex items-center gap-2 font-semibold"><EyeOff className="h-5 w-5" />Je restaurant is nog niet zichtbaar voor gasten</h2>
      <p className="mt-2 text-sm">
        Gasten vinden je op Dishloopr via je gerechten. Daarvoor zijn minimaal {counts.menu_minimum} gerechten nodig, drankjes niet meegeteld.
        {missing > 0 ? ` Je hebt er nu ${counts.menu_count}, dus nog ${missing} te gaan.` : ' Je zit op het minimum; zodra de gerechten verwerkt zijn, sta je online.'} Zodra je het minimum haalt, sta je automatisch online.
      </p>
      <Progress value={Math.min(100, (counts.menu_count / counts.menu_minimum) * 100)} className="mt-3 h-2" aria-label="Voortgang menu" />
      <Button className="mt-4" onClick={onAddMenu}>Menu aanvullen</Button>
    </section>
  );
}
