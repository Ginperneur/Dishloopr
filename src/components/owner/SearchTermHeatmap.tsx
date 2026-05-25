import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search } from 'lucide-react';

export function SearchTermHeatmap({ restaurantId, days = 30 }: { restaurantId: string; days?: number }) {
  const [terms, setTerms] = useState<{ search_term: string; hits: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any).rpc('get_search_term_heatmap', {
        p_restaurant_id: restaurantId, p_days: days, p_limit: 15,
      });
      if (!error && data) setTerms(data);
      setLoading(false);
    })();
  }, [restaurantId, days]);

  const max = terms[0]?.hits || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="h-5 w-5 text-primary" />
          Top zoektermen <span className="text-xs font-normal text-muted-foreground">· laatste {days} dagen</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Laden…</p>
        ) : terms.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Nog geen zoektermen vastgelegd voor jouw restaurant.</p>
        ) : (
          <ul className="space-y-2">
            {terms.map((t) => (
              <li key={t.search_term} className="flex items-center gap-3 text-sm">
                <span className="w-40 truncate font-medium">{t.search_term}</span>
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${(Number(t.hits) / max) * 100}%` }} />
                </div>
                <span className="tabular-nums text-xs text-muted-foreground w-10 text-right">{t.hits}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}