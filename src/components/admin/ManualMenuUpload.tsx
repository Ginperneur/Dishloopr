import { useState, useEffect, useRef } from 'react';
import { Search, Upload, FileText, Camera, Loader2, Check, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type RestaurantRow = {
  id: string;
  name: string;
  address: string | null;
  website_url: string | null;
  has_dishes: boolean;
  last_scrape_status: string | null;
};

type Status = 'idle' | 'uploading' | 'parsing' | 'success' | 'error';

type ParseResult = {
  added: string[];
  existing: string[];
  errors: string[];
  totalProcessed: number;
};

type ListFilter = 'no_dishes' | 'scrape_failed' | 'all';

const FILTER_LABELS: Record<ListFilter, string> = {
  no_dishes: 'Zonder gerechten',
  scrape_failed: 'Scrape mislukt',
  all: 'Alle restaurants',
};

export function ManualMenuUpload() {
  const [restaurants, setRestaurants] = useState<RestaurantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ListFilter>('scrape_failed');
  const [selected, setSelected] = useState<RestaurantRow | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadRestaurants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const fetchAll = async <T,>(builder: () => any): Promise<T[]> => {
    const all: T[] = [];
    let from = 0;
    const pageSize = 300;
    while (true) {
      const { data } = await builder().range(from, from + pageSize - 1);
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  };

  const loadRestaurants = async () => {
    setLoading(true);
    try {
      // 1. Get all active restaurants
      const restaurantsAll = await fetchAll<{ id: string; name: string; address: string | null; website_url: string | null }>(
        () => supabase.from('restaurants').select('id, name, address, website_url').eq('is_active', true).order('name')
      );

      const restIds = restaurantsAll.map(r => r.id);

      // 2. Get all restaurant_ids that have any dish
      const dishRows = await fetchAll<{ restaurant_id: string }>(
        () => supabase.from('restaurant_dishes').select('restaurant_id').in('restaurant_id', restIds.slice(0, 1000))
      );
      // batched lookup for >1000 restaurants
      const dishIds = new Set(dishRows.map(r => r.restaurant_id));
      for (let i = 1000; i < restIds.length; i += 1000) {
        const chunk = restIds.slice(i, i + 1000);
        const more = await fetchAll<{ restaurant_id: string }>(
          () => supabase.from('restaurant_dishes').select('restaurant_id').in('restaurant_id', chunk)
        );
        more.forEach(r => dishIds.add(r.restaurant_id));
      }

      // 3. Get last scrape status per restaurant
      const scrapeRows = await fetchAll<{ restaurant_id: string; status: string; created_at: string }>(
        () => supabase.from('menu_scrape_runs').select('restaurant_id, status, created_at').order('created_at', { ascending: false })
      );
      const lastScrapeByRestaurant = new Map<string, string>();
      for (const row of scrapeRows) {
        if (!lastScrapeByRestaurant.has(row.restaurant_id)) {
          lastScrapeByRestaurant.set(row.restaurant_id, row.status);
        }
      }

      const enriched: RestaurantRow[] = restaurantsAll.map(r => ({
        ...r,
        has_dishes: dishIds.has(r.id),
        last_scrape_status: lastScrapeByRestaurant.get(r.id) || null,
      }));

      let filtered = enriched;
      if (filter === 'no_dishes') {
        filtered = enriched.filter(r => !r.has_dishes);
      } else if (filter === 'scrape_failed') {
        filtered = enriched.filter(r => r.last_scrape_status && r.last_scrape_status !== 'success' && !r.has_dishes);
      }

      setRestaurants(filtered);
    } catch (err) {
      console.error(err);
      toast.error('Restaurants laden mislukt');
    } finally {
      setLoading(false);
    }
  };

  const filteredRestaurants = restaurants.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.address?.toLowerCase().includes(search.toLowerCase())
  );

  const resetUpload = () => {
    setStatus('idle');
    setProgress(0);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Bestand lezen mislukt'));
    reader.readAsDataURL(file);
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Alleen afbeeldingen (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('Bestand te groot (max 20MB)');
      return;
    }
    setStatus('uploading');
    setProgress(20);
    setError(null);
    setResult(null);
    try {
      const base64 = await fileToBase64(file);
      setProgress(40);
      setStatus('parsing');
      const { data, error: invokeError } = await supabase.functions.invoke('parse-menu-image', {
        body: { restaurantId: selected.id, imageBase64: base64 },
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data.error) throw new Error(data.error);
      setProgress(100);
      setStatus('success');
      setResult(data);
      toast.success(`${data.added.length} nieuwe gerechten toegevoegd`);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Onbekende fout');
      toast.error('Foto verwerken mislukt');
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    if (file.type !== 'application/pdf') {
      toast.error('Alleen PDF bestanden');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error('PDF te groot (max 20MB)');
      return;
    }
    setStatus('uploading');
    setProgress(20);
    setError(null);
    setResult(null);
    try {
      const base64 = await fileToBase64(file);
      setProgress(40);
      setStatus('parsing');
      const { data, error: invokeError } = await supabase.functions.invoke('parse-menu-pdf', {
        body: { restaurantId: selected.id, pdfBase64: base64 },
      });
      if (invokeError) throw new Error(invokeError.message);
      if (data.error) throw new Error(data.error);
      setProgress(100);
      setStatus('success');
      setResult(data);
      toast.success(`${data.added.length} nieuwe gerechten toegevoegd`);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Onbekende fout');
      toast.error('PDF verwerken mislukt');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Handmatig Menu Toevoegen
            </CardTitle>
            <CardDescription>
              Voor restaurants waar scrapen niet werkt: upload een foto van het menu of een PDF.
            </CardDescription>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as ListFilter)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FILTER_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!selected ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek restaurant op naam of adres..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {loading ? 'Laden...' : `${filteredRestaurants.length} restaurants (${FILTER_LABELS[filter]})`}
            </p>
            <ScrollArea className="h-[450px] border rounded-lg">
              {loading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : filteredRestaurants.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Geen restaurants gevonden voor dit filter.
                </p>
              ) : (
                <div className="divide-y">
                  {filteredRestaurants.slice(0, 200).map(r => (
                    <button
                      key={r.id}
                      onClick={() => { setSelected(r); resetUpload(); }}
                      className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{r.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.address || 'Geen adres'}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!r.has_dishes && <Badge variant="outline" className="text-[10px]">0 gerechten</Badge>}
                        {r.last_scrape_status === 'failed' && (
                          <Badge variant="destructive" className="text-[10px]">Scrape mislukt</Badge>
                        )}
                        {!r.website_url && <Badge variant="secondary" className="text-[10px]">Geen site</Badge>}
                      </div>
                    </button>
                  ))}
                  {filteredRestaurants.length > 200 && (
                    <p className="p-3 text-xs text-muted-foreground text-center">
                      Eerste 200 getoond — verfijn je zoekopdracht
                    </p>
                  )}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="min-w-0">
                <p className="font-medium truncate">{selected.name}</p>
                <p className="text-xs text-muted-foreground truncate">{selected.address}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSelected(null); resetUpload(); }}>
                <X className="h-4 w-4 mr-1" />Wissel
              </Button>
            </div>

            {status === 'idle' && (
              <Tabs defaultValue="image">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="image"><Camera className="h-4 w-4 mr-2" />Foto</TabsTrigger>
                  <TabsTrigger value="pdf"><FileText className="h-4 w-4 mr-2" />PDF</TabsTrigger>
                </TabsList>
                <TabsContent value="image" className="mt-4">
                  <div
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Camera className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium">Klik om een foto te uploaden</p>
                    <p className="text-sm text-muted-foreground mt-1">JPG, PNG of WebP (max 20MB)</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </TabsContent>
                <TabsContent value="pdf" className="mt-4">
                  <div
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => pdfInputRef.current?.click()}
                  >
                    <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium">Klik om een PDF te uploaden</p>
                    <p className="text-sm text-muted-foreground mt-1">Menu PDF (max 20MB) — alle pagina's worden geanalyseerd</p>
                  </div>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />
                </TabsContent>
              </Tabs>
            )}

            {(status === 'uploading' || status === 'parsing') && (
              <div className="py-6 space-y-3">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span>{status === 'uploading' ? 'Bestand voorbereiden...' : 'Gerechten herkennen met AI...'}</span>
                </div>
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">Dit kan 10-60 seconden duren afhankelijk van menu-omvang.</p>
              </div>
            )}

            {status === 'success' && result && (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2 text-primary">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Menu succesvol verwerkt!</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border text-center">
                    <p className="text-2xl font-bold text-primary">{result.added.length}</p>
                    <p className="text-xs text-muted-foreground">Nieuw</p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <p className="text-2xl font-bold">{result.existing.length}</p>
                    <p className="text-xs text-muted-foreground">Bestaand</p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <p className="text-2xl font-bold">{result.totalProcessed}</p>
                    <p className="text-xs text-muted-foreground">Totaal</p>
                  </div>
                </div>
                {result.added.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Toegevoegd (in goedkeuring queue):</p>
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                      {result.added.map((d, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{d}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetUpload} className="flex-1">Nog een menu uploaden</Button>
                  <Button onClick={() => { setSelected(null); resetUpload(); loadRestaurants(); }} className="flex-1">
                    Volgend restaurant
                  </Button>
                </div>
              </div>
            )}

            {status === 'error' && (
              <div className="py-4 space-y-3">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Er ging iets mis</span>
                </div>
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" onClick={resetUpload} className="w-full">Opnieuw proberen</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}