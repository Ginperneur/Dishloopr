import { useEffect, useMemo, useState } from 'react';
import { Search, Loader2, AlertCircle, Globe, Upload, ExternalLink, RefreshCw, ArrowUpDown, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type EmptyRow = {
  id: string;
  name: string;
  address: string | null;
  website_url: string | null;
  city_id: string | null;
  city_name: string | null;
  rating: number | null;
  is_active: boolean;
  last_scrape_status: string | null;
  last_scrape_at: string | null;
  created_at: string;
};

type SortKey = 'name' | 'city' | 'rating' | 'created' | 'scrape_status';

interface Props {
  onNavigateToTab?: (tab: string) => void;
}

export function EmptyDishesManager({ onNavigateToTab }: Props) {
  const [rows, setRows] = useState<EmptyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [scrapeFilter, setScrapeFilter] = useState<'all' | 'never' | 'failed' | 'success'>('all');
  const [websiteFilter, setWebsiteFilter] = useState<'all' | 'with' | 'without'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('city');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    load();
  }, []);

  const fetchAll = async <T,>(builder: () => any): Promise<T[]> => {
    const all: T[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await builder().range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all.push(...data);
      if (data.length < pageSize) break;
      from += pageSize;
    }
    return all;
  };

  const load = async () => {
    setLoading(true);
    try {
      // 1. Alle actieve restaurants + city
      const restaurants = await fetchAll<{
        id: string; name: string; address: string | null; website_url: string | null;
        city_id: string | null; rating: number | null; is_active: boolean; created_at: string;
        cities: { name: string } | null;
      }>(() =>
        supabase
          .from('restaurants')
          .select('id, name, address, website_url, city_id, rating, is_active, created_at, cities:city_id(name)')
          .eq('is_active', true)
          .order('name')
      );

      const restIds = restaurants.map(r => r.id);

      // 2. Restaurants met >=1 gerecht (gechunked)
      const dishIds = new Set<string>();
      for (let i = 0; i < restIds.length; i += 1000) {
        const chunk = restIds.slice(i, i + 1000);
        const dishRows = await fetchAll<{ restaurant_id: string }>(
          () => supabase.from('restaurant_dishes').select('restaurant_id').in('restaurant_id', chunk)
        );
        dishRows.forEach(d => dishIds.add(d.restaurant_id));
      }

      // 3. Laatste scrape status per restaurant
      const scrapeRows = await fetchAll<{ restaurant_id: string; status: string; created_at: string }>(
        () => supabase.from('menu_scrape_runs').select('restaurant_id, status, created_at').order('created_at', { ascending: false })
      );
      const lastScrape = new Map<string, { status: string; at: string }>();
      for (const r of scrapeRows) {
        if (!lastScrape.has(r.restaurant_id)) {
          lastScrape.set(r.restaurant_id, { status: r.status, at: r.created_at });
        }
      }

      const empty: EmptyRow[] = restaurants
        .filter(r => !dishIds.has(r.id))
        .map(r => ({
          id: r.id,
          name: r.name,
          address: r.address,
          website_url: r.website_url,
          city_id: r.city_id,
          city_name: r.cities?.name || null,
          rating: r.rating,
          is_active: r.is_active,
          last_scrape_status: lastScrape.get(r.id)?.status || null,
          last_scrape_at: lastScrape.get(r.id)?.at || null,
          created_at: r.created_at,
        }));

      setRows(empty);
    } catch (err) {
      console.error(err);
      toast.error('Laden mislukt');
    } finally {
      setLoading(false);
    }
  };

  const cities = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    rows.forEach(r => {
      const key = r.city_id || 'none';
      const name = r.city_name || 'Onbekend';
      if (!map.has(key)) map.set(key, { id: key, name, count: 0 });
      map.get(key)!.count += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [rows]);

  const filtered = useMemo(() => {
    let result = rows;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r => r.name.toLowerCase().includes(s) || r.address?.toLowerCase().includes(s));
    }
    if (cityFilter !== 'all') {
      result = result.filter(r => (r.city_id || 'none') === cityFilter);
    }
    if (scrapeFilter === 'never') result = result.filter(r => !r.last_scrape_status);
    else if (scrapeFilter === 'failed') result = result.filter(r => r.last_scrape_status && r.last_scrape_status !== 'success');
    else if (scrapeFilter === 'success') result = result.filter(r => r.last_scrape_status === 'success');
    if (websiteFilter === 'with') result = result.filter(r => !!r.website_url);
    else if (websiteFilter === 'without') result = result.filter(r => !r.website_url);

    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break;
        case 'city': cmp = (a.city_name || 'zzz').localeCompare(b.city_name || 'zzz'); break;
        case 'rating': cmp = (b.rating || 0) - (a.rating || 0); break;
        case 'created': cmp = new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); break;
        case 'scrape_status': cmp = (a.last_scrape_status || 'zzz').localeCompare(b.last_scrape_status || 'zzz'); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [rows, search, cityFilter, scrapeFilter, websiteFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const scrapeStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline" className="text-[10px]">Nooit gescraped</Badge>;
    if (status === 'success') return <Badge variant="secondary" className="text-[10px]">Scrape OK (geen)</Badge>;
    return <Badge variant="destructive" className="text-[10px]">Scrape mislukt</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Restaurants zonder gerechten
            </CardTitle>
            <CardDescription>
              {loading ? 'Laden…' : `${rows.length} restaurants hebben 0 gerechten in de database.`}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Vernieuwen
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats per stad */}
        {!loading && cities.length > 0 && (
          <ScrollArea className="w-full whitespace-nowrap rounded-lg border bg-muted/20 p-2">
            <div className="flex gap-2">
              {cities.slice(0, 20).map(c => (
                <button
                  key={c.id}
                  onClick={() => setCityFilter(cityFilter === c.id ? 'all' : c.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-md text-xs border transition-colors ${
                    cityFilter === c.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-border'
                  }`}
                >
                  <MapPin className="h-3 w-3 inline mr-1" />
                  {c.name} <span className="opacity-70">({c.count})</span>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Zoek op naam of adres…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle steden</SelectItem>
              {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.count})</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={scrapeFilter} onValueChange={v => setScrapeFilter(v as any)}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle scrape-status</SelectItem>
              <SelectItem value="never">Nooit gescraped</SelectItem>
              <SelectItem value="failed">Scrape mislukt</SelectItem>
              <SelectItem value="success">Scrape OK (leeg)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={websiteFilter} onValueChange={v => setWebsiteFilter(v as any)}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Met/zonder site</SelectItem>
              <SelectItem value="with">Met website</SelectItem>
              <SelectItem value="without">Zonder website</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabel */}
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-foreground">
                      Naam <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort('city')} className="flex items-center gap-1 hover:text-foreground">
                      Stad <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-center">
                    <button onClick={() => toggleSort('rating')} className="flex items-center gap-1 hover:text-foreground mx-auto">
                      Rating <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>
                    <button onClick={() => toggleSort('scrape_status')} className="flex items-center gap-1 hover:text-foreground">
                      Scrape <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-sm text-muted-foreground">
                    Geen restaurants gevonden voor deze filters 🎉
                  </TableCell></TableRow>
                ) : (
                  filtered.slice(0, 300).map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <div className="min-w-0">
                          <p className="truncate">{r.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.address || '—'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.city_name || '—'}</TableCell>
                      <TableCell className="text-center text-sm">{r.rating ? Number(r.rating).toFixed(1) : '—'}</TableCell>
                      <TableCell>
                        {r.website_url ? (
                          <a href={r.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <ExternalLink className="h-3 w-3" />Site
                          </a>
                        ) : <Badge variant="secondary" className="text-[10px]">Geen site</Badge>}
                      </TableCell>
                      <TableCell>{scrapeStatusBadge(r.last_scrape_status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {r.website_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => onNavigateToTab?.('menu-scraper')}
                              title="Naar Menu Scraper"
                            >
                              <Globe className="h-3.5 w-3.5 mr-1" />Scrape
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => onNavigateToTab?.('manual-menu')}
                            title="Naar Handmatig Menu"
                          >
                            <Upload className="h-3.5 w-3.5 mr-1" />Upload
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 300 && (
            <p className="p-2 text-xs text-center text-muted-foreground border-t">
              Eerste 300 van {filtered.length} getoond — verfijn je filter
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}