import { useState, useEffect } from 'react';
import { Globe, Loader2, CheckCircle2, AlertCircle, Play, ListPlus, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ScrapeFilter = 'all' | 'missing' | 'no_approved' | 'never_scraped' | 'scrape_failed';
type QueueStatus = 'queued' | 'processing' | 'done' | 'failed' | 'canceled';

interface QueueRecentItem {
  id: string;
  restaurant_name: string;
  status: QueueStatus;
  error: string | null;
  added_dishes: number | null;
  finished_at: string | null;
  started_at: string | null;
}

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
  scrape_failed: { label: 'Scrape mislukt', description: 'Vorige scrape-poging faalde — overweeg handmatige upload' },
};

export function MenuScraper() {
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [filter, setFilter] = useState<ScrapeFilter>('missing');
  const [queueing, setQueueing] = useState(false);
  const [queueStats, setQueueStats] = useState({ queued: 0, processing: 0, done: 0, failed: 0, canceled: 0 });
  const [queueRecent, setQueueRecent] = useState<QueueRecentItem[]>([]);

  // Poll queue stats every 5s
  useEffect(() => {
    const fetchQueueStatus = async () => {
      const { data } = await supabase
        .from('scrape_queue')
        .select('status');
      if (data) {
        const stats = { queued: 0, processing: 0, done: 0, failed: 0, canceled: 0 };
        data.forEach((r) => {
          const status = r.status as QueueStatus;
          if (stats[status] !== undefined) {
            stats[status]++;
          }
        });
        setQueueStats(stats);
      }
      const { data: recent } = await supabase
        .from('scrape_queue')
        .select('id, restaurant_name, status, error, added_dishes, finished_at, started_at')
        .order('updated_at', { ascending: false })
        .limit(15);
      setQueueRecent((recent || []).map((item) => ({
        ...item,
        status: item.status as QueueStatus,
      })));
    };
    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 5000);
    return () => clearInterval(interval);
  }, []);

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
        const baseQuery = supabase
          .from('restaurant_dishes')
          .select('restaurant_id')
          .in('restaurant_id', chunk);

        const { data } = extraFilter
          ? Array.isArray(extraFilter.value)
            ? await baseQuery.in(extraFilter.column, extraFilter.value).range(from, from + pageSize - 1)
            : await baseQuery.eq(extraFilter.column, extraFilter.value).range(from, from + pageSize - 1)
          : await baseQuery.range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        data.forEach(d => ids.add(d.restaurant_id));
        if (data.length < pageSize) break;
        from += pageSize;
      }
    }

    return ids;
  };

  const fetchDistinctScrapeRunRestaurantIds = async (restaurantIds: string[]): Promise<Set<string>> => {
    const ids = new Set<string>();
    const chunkSize = 200;

    for (let i = 0; i < restaurantIds.length; i += chunkSize) {
      const chunk = restaurantIds.slice(i, i + chunkSize);
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data } = await supabase
          .from('menu_scrape_runs')
          .select('restaurant_id')
          .in('restaurant_id', chunk)
          .range(from, from + pageSize - 1);

        if (!data || data.length === 0) break;
        data.forEach((d) => ids.add(d.restaurant_id));
        if (data.length < pageSize) break;
        from += pageSize;
      }
    }

    return ids;
  };

  const fetchFailedScrapeRestaurantIds = async (restaurantIds: string[]): Promise<Set<string>> => {
    // Get the latest scrape run per restaurant; keep those whose latest status is not 'success'
    const latestStatusByRestaurant = new Map<string, string>();
    const chunkSize = 200;

    for (let i = 0; i < restaurantIds.length; i += chunkSize) {
      const chunk = restaurantIds.slice(i, i + chunkSize);
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data } = await supabase
          .from('menu_scrape_runs')
          .select('restaurant_id, status, created_at')
          .in('restaurant_id', chunk)
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (!data || data.length === 0) break;
        for (const row of data) {
          if (!latestStatusByRestaurant.has(row.restaurant_id)) {
            latestStatusByRestaurant.set(row.restaurant_id, row.status);
          }
        }
        if (data.length < pageSize) break;
        from += pageSize;
      }
    }

    const failed = new Set<string>();
    latestStatusByRestaurant.forEach((status, id) => {
      if (status !== 'success') failed.add(id);
    });
    return failed;
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
      const idsWithAnyScrapeAttempt = await fetchDistinctScrapeRunRestaurantIds(restaurantIds);
      return { data: restaurants.filter(r => !idsWithAnyScrapeAttempt.has(r.id)), error: null };
    }

    if (filter === 'scrape_failed') {
      const failedIds = await fetchFailedScrapeRestaurantIds(restaurantIds);
      return { data: restaurants.filter(r => failedIds.has(r.id)), error: null };
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

  const handleAddToQueue = async () => {
    setQueueing(true);
    const { data: restaurants, error } = await fetchFilteredRestaurants();
    if (error || !restaurants?.length) {
      toast.error(error || 'Geen restaurants gevonden voor dit filter');
      setQueueing(false);
      return;
    }

    // Check which restaurants are already in queue (queued/processing)
    const { data: existing } = await supabase
      .from('scrape_queue')
      .select('restaurant_id')
      .in('restaurant_id', restaurants.map((r) => r.id))
      .in('status', ['queued', 'processing']);
    const existingIds = new Set((existing || []).map((e) => e.restaurant_id));

    const toInsert = restaurants
      .filter((r) => !existingIds.has(r.id))
      .map((r) => ({
        restaurant_id: r.id,
        restaurant_name: r.name,
        website_url: r.website_url!,
        source: 'menu_scraper',
      }));

    if (toInsert.length === 0) {
      toast.info('Alle restaurants staan al in de queue');
      setQueueing(false);
      return;
    }

    // Insert in chunks of 500
    const chunkSize = 500;
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const chunk = toInsert.slice(i, i + chunkSize);
      const { error: insertErr } = await supabase.from('scrape_queue').insert(chunk);
      if (!insertErr) inserted += chunk.length;
    }

    toast.success(`${inserted} restaurants toegevoegd aan queue. Worker verwerkt ze automatisch op de achtergrond.`);
    setQueueing(false);
  };

  const handleClearCompleted = async () => {
    if (!confirm('Verwijder alle voltooide, mislukte en geannuleerde items uit de queue?')) return;
    const { error } = await supabase
      .from('scrape_queue')
      .delete()
      .in('status', ['done', 'failed', 'canceled']);
    if (error) toast.error(error.message);
    else toast.success('Voltooide items verwijderd');
  };

  const handleCancelQueue = async () => {
    if (!confirm('Annuleer alle wachtende en lopende scrape-items? Het item dat nu bezig is kan nog afronden, maar wordt niet opnieuw opgepakt.')) return;
    const { error } = await supabase
      .from('scrape_queue')
      .update({
        status: 'canceled',
        error: 'Handmatig geannuleerd',
        started_at: null,
        finished_at: new Date().toISOString(),
      })
      .in('status', ['queued', 'processing']);
    if (error) toast.error(error.message);
    else toast.success('Queue geannuleerd');
  };

  const handleRetryFailed = async () => {
    const { error } = await supabase
      .from('scrape_queue')
      .update({ status: 'queued', attempts: 0, error: null, finished_at: null })
      .eq('status', 'failed');
    if (error) toast.error(error.message);
    else toast.success('Mislukte items opnieuw in de queue');
  };

  const totalAdded = results.filter(r => r.status === 'success').reduce((sum, r) => sum + (r.added || 0), 0);
  const totalExisting = results.filter(r => r.status === 'success').reduce((sum, r) => sum + (r.existing || 0), 0);
  const errorCount = results.filter(r => r.status === 'error').length;
  const successCount = results.filter(r => r.status === 'success').length;

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListPlus className="h-5 w-5" />
          Background Queue
        </CardTitle>
        <CardDescription>
          Voeg restaurants toe aan de queue. Een worker verwerkt automatisch elke minuut een paar items — je kunt de tab gewoon sluiten.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">⏳ {queueStats.queued} wachtrij</Badge>
          <Badge variant="secondary">⚙️ {queueStats.processing} bezig</Badge>
          <Badge variant="default">✅ {queueStats.done} klaar</Badge>
          {queueStats.failed > 0 && (
            <Badge variant="destructive">❌ {queueStats.failed} mislukt</Badge>
          )}
          {queueStats.canceled > 0 && (
            <Badge variant="outline">⛔ {queueStats.canceled} geannuleerd</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleAddToQueue} disabled={queueing} variant="default">
            {queueing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ListPlus className="h-4 w-4 mr-2" />}
            Voeg "{FILTER_LABELS[filter].label}" toe aan queue
          </Button>
          {queueStats.failed > 0 && (
            <Button onClick={handleRetryFailed} variant="outline" size="sm">
              <Play className="h-4 w-4 mr-2" />
              Probeer mislukte opnieuw
            </Button>
          )}
          {(queueStats.queued > 0 || queueStats.processing > 0) && (
            <Button onClick={handleCancelQueue} variant="destructive" size="sm">
              <XCircle className="h-4 w-4 mr-2" />
              Annuleer queue
            </Button>
          )}
          {(queueStats.done > 0 || queueStats.failed > 0 || queueStats.canceled > 0) && (
            <Button onClick={handleClearCompleted} variant="ghost" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Verwijder voltooide
            </Button>
          )}
        </div>

        {queueRecent.length > 0 && (
          <ScrollArea className="h-[200px] border rounded-md p-2">
            <div className="space-y-1">
              {queueRecent.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm p-2 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.status === 'queued' && <div className="h-2 w-2 rounded-full bg-muted-foreground" />}
                    {item.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                    {item.status === 'done' && <CheckCircle2 className="h-3 w-3 text-primary" />}
                    {item.status === 'failed' && <AlertCircle className="h-3 w-3 text-destructive" />}
                    {item.status === 'canceled' && <XCircle className="h-3 w-3 text-muted-foreground" />}
                    <span className="truncate">{item.restaurant_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {item.status === 'done' && `+${item.added_dishes ?? 0} gerechten`}
                    {item.status === 'failed' && (item.error?.slice(0, 40) || 'fout')}
                    {item.status === 'canceled' && 'Geannuleerd'}
                    {item.status === 'processing' && 'Bezig...'}
                    {item.status === 'queued' && 'In wachtrij'}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Menu Scraper (Live)
            </CardTitle>
            <CardDescription>
              Live scrapen — tab moet open blijven. Voor grote batches: gebruik de Background Queue hierboven.
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
    </div>
  );
}
