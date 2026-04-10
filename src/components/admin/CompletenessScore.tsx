import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, RefreshCw, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface ScoredRestaurant {
  id: string;
  name: string;
  slug: string;
  city_name: string;
  score: number;
  missing: string[];
}

const FIELDS = [
  { key: 'images', label: 'Foto\'s', check: (r: any) => r.images && r.images.length > 0 },
  { key: 'phone', label: 'Telefoon', check: (r: any) => !!r.phone },
  { key: 'website_url', label: 'Website', check: (r: any) => !!r.website_url },
  { key: 'geo', label: 'Coördinaten', check: (r: any) => !!r.geo_lat && !!r.geo_lng },
  { key: 'cuisines', label: 'Keuken', check: (r: any) => r.cuisines && r.cuisines.length > 0 },
  { key: 'opening_hours', label: 'Openingstijden', check: (r: any) => !!r.opening_hours },
  { key: 'dishes', label: 'Gerechten', check: (r: any, dishSet?: Set<string>) => dishSet ? dishSet.has(r.id) : false },
  { key: 'ambience', label: 'Sfeer-tags', check: (r: any) => r.ambience_tags && r.ambience_tags.length > 0 },
  { key: 'price', label: 'Prijsniveau', check: (r: any) => r.price_level > 0 },
  { key: 'postal', label: 'Postcode', check: (r: any) => !!r.postal_code },
];

const PER_PAGE = 50;

export function CompletenessScore() {
  const [loading, setLoading] = useState(true);
  const [scored, setScored] = useState<ScoredRestaurant[]>([]);
  const [filter, setFilter] = useState<string>('incomplete');
  const [page, setPage] = useState(1);

  useEffect(() => {
    runScore();
  }, []);

  const runScore = async () => {
    setLoading(true);

    let allRestaurants: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, slug, images, phone, website_url, geo_lat, geo_lng, cuisines, opening_hours, ambience_tags, price_level, postal_code, cities:city_id(name)')
        .eq('is_active', true)
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      allRestaurants = allRestaurants.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }

    let allDishLinks: any[] = [];
    let dishFrom = 0;
    while (true) {
      const { data: batch } = await supabase
        .from('restaurant_dishes')
        .select('restaurant_id')
        .neq('status', 'rejected')
        .range(dishFrom, dishFrom + 999);
      if (!batch || batch.length === 0) break;
      allDishLinks = allDishLinks.concat(batch);
      if (batch.length < 1000) break;
      dishFrom += 1000;
    }
    const dishSet = new Set(allDishLinks.map((d: any) => d.restaurant_id));

    const results: ScoredRestaurant[] = allRestaurants.map((r: any) => {
      const missing: string[] = [];
      let filled = 0;
      
      FIELDS.forEach(f => {
        if (f.key === 'dishes' ? f.check(r, dishSet) : f.check(r)) {
          filled++;
        } else {
          missing.push(f.label);
        }
      });

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        city_name: (r.cities as any)?.name || 'Onbekend',
        score: Math.round((filled / FIELDS.length) * 100),
        missing,
      };
    });

    results.sort((a, b) => a.score - b.score);
    setScored(results);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    switch (filter) {
      case 'incomplete': return scored.filter(r => r.score < 100);
      case 'critical': return scored.filter(r => r.score < 50);
      case 'complete': return scored.filter(r => r.score === 100);
      default: return scored;
    }
  }, [scored, filter]);

  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const avgScore = scored.length > 0 ? Math.round(scored.reduce((s, r) => s + r.score, 0) / scored.length) : 0;
  const complete = scored.filter(r => r.score === 100).length;
  const critical = scored.filter(r => r.score < 50).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Completeness scores berekenen...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="cursor-pointer" onClick={() => { setFilter('all'); setPage(1); }}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{avgScore}%</p>
            <p className="text-xs text-muted-foreground">Gem. score</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => { setFilter('complete'); setPage(1); }}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{complete}</p>
            <p className="text-xs text-muted-foreground">100% compleet</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => { setFilter('incomplete'); setPage(1); }}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{scored.length - complete}</p>
            <p className="text-xs text-muted-foreground">Incompleet</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => { setFilter('critical'); setPage(1); }}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{critical}</p>
            <p className="text-xs text-muted-foreground">&lt;50% compleet</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Completeness per restaurant
              </CardTitle>
              <CardDescription>{filtered.length} restaurants</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={runScore}>
              <RefreshCw className="h-4 w-4 mr-1" />Herberekenen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead>Stad</TableHead>
                <TableHead className="w-32">Score</TableHead>
                <TableHead>Ontbrekend</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-sm">{r.name}</TableCell>
                  <TableCell className="text-sm">{r.city_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={r.score} className="h-2 w-16" />
                      <span className={`text-xs font-medium ${r.score === 100 ? 'text-emerald-600' : r.score < 50 ? 'text-destructive' : 'text-yellow-600'}`}>
                        {r.score}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.missing.map(m => (
                        <Badge key={m} variant="outline" className="text-[10px] py-0">{m}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`/restaurant/${r.slug}`, '_blank')}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-3 border-t">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">{page}/{totalPages}</span>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
