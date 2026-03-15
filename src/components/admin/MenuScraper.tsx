import { useState } from 'react';
import { Globe, Loader2, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ScrapeResult {
  restaurantId: string;
  restaurantName: string;
  status: 'pending' | 'scraping' | 'success' | 'error';
  added?: number;
  existing?: number;
  error?: string;
  scrapedUrl?: string;
}

export function MenuScraper() {
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

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

  const handleBulkScrape = async () => {
    setIsRunning(true);
    setResults([]);
    setProgress(0);

    // Fetch all restaurants with website URLs
    const { data: restaurants, error } = await supabase
      .from('restaurants')
      .select('id, name, website_url')
      .not('website_url', 'is', null)
      .neq('website_url', '')
      .eq('is_active', true)
      .order('name');

    if (error || !restaurants?.length) {
      toast.error(error?.message || 'Geen restaurants met website gevonden');
      setIsRunning(false);
      return;
    }

    setTotalCount(restaurants.length);
    toast.info(`Start scraping van ${restaurants.length} restaurants...`);

    const initialResults: ScrapeResult[] = restaurants.map(r => ({
      restaurantId: r.id,
      restaurantName: r.name,
      status: 'pending' as const,
    }));
    setResults(initialResults);

    let completedCount = 0;

    // Process sequentially to avoid rate limits
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

      // Small delay between requests
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Menu Scraper
            </CardTitle>
            <CardDescription>
              Scrape automatisch menu's van restaurant websites met Firecrawl + AI
            </CardDescription>
          </div>
          <Button onClick={handleBulkScrape} disabled={isRunning} size="lg">
            {isRunning ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Bezig...</>
            ) : (
              <><Play className="h-4 w-4 mr-2" />Bulk Scrape Starten</>
            )}
          </Button>
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
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
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
            Klik op "Bulk Scrape Starten" om automatisch menu's van alle restaurants met een website te scrapen.
            Gevonden gerechten verschijnen in Dish Approval.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
