import { useState } from 'react';
import { Globe, Loader2, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ScrapeFilter = 'all' | 'missing' | 'no_approved' | 'never_scraped';

interface ScrapeResult {
  restaurantId: string;
  restaurantName: string;
  status: 'pending' | 'scraping' | 'success' | 'error';
  added?: number;
  existing?: number;
  error?: string;
  scrapedUrl?: string;
}

const FILTER_LABELS: Record<ScrapeFilter, { label: string; description: string }> = {
  all: { label: 'Alle restaurants', description: 'Scrape alle restaurants met een website' },
  missing: { label: 'Zonder gerechten', description: 'Alleen restaurants zonder enig gerecht' },
  no_approved: { label: 'Zonder goedgekeurde gerechten', description: 'Restaurants zonder goedgekeurde gerechten' },
  never_scraped: { label: 'Nog nooit gescraped', description: 'Restaurants zonder eerdere scrape-poging' },
};

export function MenuScraper() {
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<ScrapeFilter>('missing');

  const scrapeRestaurant = async (restaurantId: string, websiteUrl: string): Promise<ScrapeResult & { restaurantName: string }> => {
    const { data, error } = await supabase.functions.invoke('scrape-menu', {
      body: { restaurantId, websiteUrl },
    });

    if (error) {
      return { restaurantId, restaurantName: '', status: 'error', error: error.message };
    }

    if (!data?.success) {
      return { restaurantId, restaurantName: '', status: 'error', error: data?.error || 'Onbekende fout' };
    }

    return {
      restaurantId,
      restaurantName: '',
      status: 'success',
      added: data.results?.added || 0,
      existing: data.results?.existing || 0,
      scrapedUrl: data.scrapedUrl,
    };
  };

  const fetchDistinctRestaurantIds = async (
    restaurantIds: string[],
    extraFilter?: { column: string; value: string | string[] }
  ): Promise<Set<string>> => {
    // Batch in chunks of 200 IDs to avoid URL length limits,
    // and paginate each chunk to avoid the 1000-row default limit
    const ids = new Set<string>();
    const chunkSize = 200;

    for (let i = 0; i < restaurantIds.length; i += chunkSize) {
      const chunk = restaurantIds.slice(i, i + chunkSize);
      let from = 0;
      const pageSize = 1000;

      while (true) {
        let query: any = supabase
          .from('restaurant_dishes')
          .select('restaurant_id')
          .in('restaurant_id', chunk)
          .range(from, from + pageSize - 1);

        if (extraFilter) {
          if (Array.isArray(extraFilter.value)) {
            query = query.in(extraFilter.column, extraFilter.value);
          } else {
            query = query.eq(extraFilter.column, extraFilter.value);
          }
        }

        const { data } = await query;
        if (!data || data.length === 0) break;
        data.forEach(d => ids.add(d.restaurant_id));
        if (data.length < pageSize) break;
        from += pageSize;
      }
    }

    return ids;
  };

  const fetchFilteredRestaurants = async () => {
    // First get all restaurants with website
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, website_url')
      .not('website_url', 'is', null)
      .neq('website_url', '')
      .eq('is_active', true)
      .order('name');

    if (error || !restaurants?.length) {
      return { data: null, error: error?.message || 'Geen restaurants met website gevonden' };
    }

    if (filter === 'all') {
      return { data: restaurants, error: null };
    }

    const restaurantIds = restaurants.map(r => r.id);

    if (filter === 'missing') {
      const idsWithDishes = await fetchDistinctRestaurantIds(restaurantIds);
      return { data: restaurants.filter(r => !idsWithDishes.has(r.id)), error: null };
    }

    if (filter === 'no_approved') {
      const idsWithApproved = await fetchDistinctRestaurantIds(restaurantIds, {
        column: 'status',
        value: ['approved_by_admin', 'verified_by_owner'],
      });
      return { data: restaurants.filter(r => !idsWithApproved.has(r.id)), error: null };
    }

    if (filter === 'never_scraped') {
      const idsScraped = await fetchDistinctRestaurantIds(restaurantIds, {
        column: 'source',
        value: ['scrape', 'firecrawl'],
      });
      return { data: restaurants.filter(r => !idsScraped.has(r.id)), error: null };
    }

    return { data: restaurants, error: null };
  };

  const handleBulkScrape = async () => {
    setIsRunning(true);
    setResults([]);
    setProgress(0);

    const { data: restaurants, error } = await fetchFilteredRestaurants();

    if (error || !restaurants?.length) {
      toast.error(error || 'Geen restaurants gevonden voor dit filter');
      setIsRunning(false);
      return;
    }

    setTotalCount(restaurants.length);
    toast.info(`Start scraping van ${restaurants.length} restaurants (${FILTER_LABELS[filter].label})...`);

    const initialResults: ScrapeResult[] = restaurants.map(r => ({
      restaurantId: r.id,
      restaurantName: r.name,
      status: 'pending' as const,
    }));
    setResults(initialResults);

    let completedCount = 0;

    for (const restaurant of restaurants) {
      setResults(prev => prev.map(r =>
        r.restaurantId === restaurant.id ? { ...r, status: 'scraping' as const } : r
      ));

      const result = await scrapeRestaurant(restaurant.id, restaurant.website_url!);

      setResults(prev => prev.map(r =>
        r.restaurantId === restaurant.id
          ? { ...r, ...result, restaurantName: restaurant.name }
          : r
      ));

      completedCount++;
      setProgress(Math.round((completedCount / restaurants.length) * 100));

      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    const successCount = results.filter(r => r.status === 'success').length;
    toast.success(`Klaar! ${successCount}/${restaurants.length} restaurants gescraped.`);
    setIsRunning(false);
  };

  const totalAdded = results.filter(r => r.status === 'success').reduce((sum, r) => sum + (r.added || 0), 0);
  const totalExisting = results.filter(r => r.status === 'success').reduce((sum, r) => sum + (r.existing || 0), 0);
  const errorCount = results.filter(r => r.status === 'error').length;
  const successCount = results.filter(r => r.status === 'success').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Menu Scraper
            </CardTitle>
            <CardDescription>
              Scrape automatisch menu's van restaurant websites met Firecrawl + AI
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Select value={filter} onValueChange={(v) => setFilter(v as ScrapeFilter)} disabled={isRunning}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FILTER_LABELS).map(([key, { label, description }]) => (
                  <SelectItem key={key} value={key}>
                    <div>
                      <span>{label}</span>
                      <span className="block text-xs text-muted-foreground">{description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleBulkScrape} disabled={isRunning} size="lg">
              {isRunning ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Bezig...</>
              ) : (
                <><Play className="h-4 w-4 mr-2" />Scrape Starten</>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isRunning && (
          <div className="mb-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Voortgang</span>
              <span>{progress}% ({results.filter(r => r.status !== 'pending').length}/{totalCount})</span>
            </div>
            <Progress value={progress} />
          </div>
        )}

        {results.length > 0 && (
          <>
            <div className="flex gap-3 mb-4 flex-wrap">
              <Badge variant="secondary">{totalAdded} nieuwe gerechten</Badge>
              <Badge variant="outline">{totalExisting} al bekend</Badge>
              <Badge variant="default">{successCount} gelukt</Badge>
              {errorCount > 0 && <Badge variant="destructive">{errorCount} fouten</Badge>}
            </div>

            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {results.map(result => (
                  <div
                    key={result.restaurantId}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {result.status === 'pending' && (
                        <div className="h-4 w-4 rounded-full bg-muted" />
                      )}
                      {result.status === 'scraping' && (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      )}
                      {result.status === 'success' && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                      {result.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-medium truncate">{result.restaurantName}</span>
                    </div>
                    <div className="text-sm text-muted-foreground shrink-0">
                      {result.status === 'success' && (
                        <span>+{result.added} nieuw, {result.existing} bekend</span>
                      )}
                      {result.status === 'error' && (
                        <span className="text-destructive">{result.error}</span>
                      )}
                      {result.status === 'scraping' && <span>Scraping...</span>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        {results.length === 0 && !isRunning && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Kies een filter en klik op "Scrape Starten" om menu's te scrapen.
            Gevonden gerechten verschijnen in Dish Approval.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
