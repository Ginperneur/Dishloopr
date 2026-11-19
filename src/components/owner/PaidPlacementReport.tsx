import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { badgeText, useRestaurantBadges } from '@/lib/paidPlacements';

type Row = { page_slug: string; surface: string; metric: 'impressie' | 'klik'; totaal: number | string };
const SURFACE: Record<string, string> = {
  gerechtpagina: 'Gerechtpagina', zoeken: 'Zoekresultaten', kaart: 'Kaart', homepage: 'Homepage', badge: 'Restaurantbadge', spotlight: 'Stadsspotlight',
};

/** What the paid places brought in the last 30 days: impressions and clicks per surface. */
export function PaidPlacementReport({ restaurantId }: { restaurantId: string }) {
  const { data: badges = [] } = useRestaurantBadges(restaurantId);
  const from = useMemo(() => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10), []);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['paid-report', restaurantId, from],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('owner_paid_stats', { p_restaurant_id: restaurantId, p_from: from });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const totals = useMemo(() => {
    const by = new Map<string, { impressie: number; klik: number }>();
    for (const r of rows) {
      const t = by.get(r.surface) ?? { impressie: 0, klik: 0 };
      t[r.metric] += Number(r.totaal) || 0;
      by.set(r.surface, t);
    }
    const all = [...by.values()].reduce((a, t) => ({ impressie: a.impressie + t.impressie, klik: a.klik + t.klik }), { impressie: 0, klik: 0 });
    return { by: [...by.entries()].sort((a, b) => b[1].impressie - a[1].impressie), all };
  }, [rows]);
  if (!badges.length && !rows.length) return null;
  const max = Math.max(1, ...totals.by.map(([, t]) => t.impressie));
  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="space-y-1">
        <h3 className="font-semibold">Wat je plekken opleverden, afgelopen 30 dagen</h3>
        {badges.length > 0 && <p className="text-sm text-muted-foreground">{badges.map(badgeText).join(' · ')}</p>}
      </div>
      {isLoading ? <div className="h-16 animate-pulse rounded bg-muted" /> : (<>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Vertoningen</p><p className="text-2xl font-bold tabular-nums">{totals.all.impressie.toLocaleString('nl-NL')}</p></div>
          <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Kliks naar je pagina</p><p className="text-2xl font-bold tabular-nums">{totals.all.klik.toLocaleString('nl-NL')}</p></div>
          <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">Klikratio</p><p className="text-2xl font-bold tabular-nums">{totals.all.impressie ? `${((totals.all.klik / totals.all.impressie) * 100).toFixed(1).replace('.', ',')}%` : '–'}</p></div>
        </div>
        {totals.by.length > 0 ? (
          <ul className="space-y-2" aria-label="Vertoningen per plek">
            {totals.by.map(([surface, t]) => (
              <li key={surface} className="grid grid-cols-[120px_minmax(0,1fr)_64px] items-center gap-3 text-sm">
                <span>{SURFACE[surface] ?? surface}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${(t.impressie / max) * 100}%` }} /></span>
                <span className="text-right tabular-nums">{t.impressie.toLocaleString('nl-NL')}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">Nog geen vertoningen geteld. De cijfers komen binnen zodra gasten je plek zien.</p>}
        <p className="text-xs text-muted-foreground">Kliks op reserveren en je website zie je onder Prestaties. Elke maand krijg je dit ook per mail.</p>
      </>)}
    </div>
  );
}
