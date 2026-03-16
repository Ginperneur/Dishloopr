import { useState, useEffect } from 'react';
import { Search, TrendingUp, AlertCircle, Loader2, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';

interface SearchTerm {
  term: string;
  count: number;
  last_searched: string;
}

export function SearchAnalytics() {
  const [popularSearches, setPopularSearches] = useState<SearchTerm[]>([]);
  const [zeroResults, setZeroResults] = useState<SearchTerm[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch search events from analytics_events
      const { data: searchEvents } = await supabase
        .from('analytics_events')
        .select('metadata, created_at')
        .eq('event_type', 'search')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (!searchEvents || searchEvents.length === 0) {
        // Try dish search_count as fallback for popular terms
        const { data: dishes } = await supabase
          .from('dishes')
          .select('name, search_count')
          .gt('search_count', 0)
          .order('search_count', { ascending: false })
          .limit(50);

        if (dishes) {
          setPopularSearches(dishes.map(d => ({
            term: d.name,
            count: d.search_count,
            last_searched: '-',
          })));
        }
        setLoading(false);
        return;
      }

      // Aggregate search terms
      const termCounts = new Map<string, { count: number; last: string; hasResults: boolean }>();
      
      for (const event of searchEvents) {
        const meta = event.metadata as any;
        const term = meta?.query || meta?.search_term || meta?.term;
        if (!term || typeof term !== 'string') continue;
        
        const normalized = term.toLowerCase().trim();
        if (normalized.length < 2) continue;
        
        const existing = termCounts.get(normalized);
        const hasResults = meta?.result_count !== 0 && meta?.results !== 0;
        
        if (existing) {
          existing.count++;
          if (event.created_at > existing.last) existing.last = event.created_at;
          if (!hasResults) existing.hasResults = false;
        } else {
          termCounts.set(normalized, {
            count: 1,
            last: event.created_at,
            hasResults,
          });
        }
      }

      const popular: SearchTerm[] = [];
      const noResults: SearchTerm[] = [];

      for (const [term, data] of termCounts) {
        const item = { term, count: data.count, last_searched: data.last };
        popular.push(item);
        if (!data.hasResults) noResults.push(item);
      }

      popular.sort((a, b) => b.count - a.count);
      noResults.sort((a, b) => b.count - a.count);

      setPopularSearches(popular.slice(0, 50));
      setZeroResults(noResults.slice(0, 30));
    } catch (err) {
      console.error('Search analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Zoek Analytics
        </CardTitle>
        <CardDescription>Inzicht in zoekgedrag van gebruikers</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Analyse laden...</p>
          </div>
        ) : (
          <Tabs defaultValue="popular">
            <TabsList>
              <TabsTrigger value="popular" className="gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Populair ({popularSearches.length})
              </TabsTrigger>
              <TabsTrigger value="zero" className="gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Geen resultaten ({zeroResults.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="popular">
              {popularSearches.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nog geen zoekdata beschikbaar</p>
                  <p className="text-xs mt-1">Zoekgedrag wordt automatisch bijgehouden via analytics events</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Zoekterm</TableHead>
                      <TableHead className="text-right">Zoekopdrachten</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {popularSearches.map((item, i) => (
                      <TableRow key={item.term}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{item.term}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{item.count}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="zero">
              {zeroResults.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Geen zoekopdrachten zonder resultaat gevonden</p>
                </div>
              ) : (
                <>
                  <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive font-medium">
                      Deze zoektermen leverden geen resultaten op — overweeg om deze gerechten of keukens toe te voegen.
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Zoekterm</TableHead>
                        <TableHead className="text-right">Pogingen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {zeroResults.map((item) => (
                        <TableRow key={item.term}>
                          <TableCell className="font-medium">{item.term}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="destructive">{item.count}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
