import { useState, useEffect } from 'react';
import { MapPin, Loader2, AlertTriangle, ChevronLeft, Eye, CheckCircle, XCircle, EyeOff, Trash2, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface CityStats {
  id: string;
  name: string;
  restaurantCount: number;
  activeCount: number;
  claimedCount: number;
  withGeocoding: number;
  coverageScore: number;
}

interface CityRestaurant {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  claimed_by_owner_id: string | null;
  address: string;
  cuisines: string[] | null;
}

export function GeographicCoverage() {
  const [cityStats, setCityStats] = useState<CityStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRestaurants, setTotalRestaurants] = useState(0);
  const [selectedCity, setSelectedCity] = useState<CityStats | null>(null);
  const [cityRestaurants, setCityRestaurants] = useState<CityRestaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    fetchCoverage();
  }, []);

  const fetchCoverage = async () => {
    setLoading(true);
    try {
      const { data: cities } = await supabase
        .from('cities')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');

      if (!cities) { setLoading(false); return; }

      let allRestaurants: any[] = [];
      let from = 0;
      while (true) {
        const { data: batch } = await supabase
          .from('restaurants')
          .select('id, city_id, is_active, claimed_by_owner_id, geo_lat, geo_lng')
          .range(from, from + 999);
        if (!batch || batch.length === 0) break;
        allRestaurants = allRestaurants.concat(batch);
        if (batch.length < 1000) break;
        from += 1000;
      }

      setTotalRestaurants(allRestaurants.length);

      const cityMap = new Map<string, { total: number; active: number; claimed: number; geocoded: number }>();
      for (const r of allRestaurants) {
        const entry = cityMap.get(r.city_id) || { total: 0, active: 0, claimed: 0, geocoded: 0 };
        entry.total++;
        if (r.is_active) entry.active++;
        if (r.claimed_by_owner_id) entry.claimed++;
        if (r.geo_lat && r.geo_lng) entry.geocoded++;
        cityMap.set(r.city_id, entry);
      }

      const stats: CityStats[] = cities.map(city => {
        const data = cityMap.get(city.id) || { total: 0, active: 0, claimed: 0, geocoded: 0 };
        const geoScore = data.total > 0 ? (data.geocoded / data.total) * 40 : 0;
        const activeScore = data.total > 0 ? (data.active / data.total) * 30 : 0;
        const claimedScore = data.total > 0 ? (data.claimed / data.total) * 30 : 0;
        return {
          id: city.id,
          name: city.name,
          restaurantCount: data.total,
          activeCount: data.active,
          claimedCount: data.claimed,
          withGeocoding: data.geocoded,
          coverageScore: Math.round(geoScore + activeScore + claimedScore),
        };
      });

      stats.sort((a, b) => b.restaurantCount - a.restaurantCount);
      setCityStats(stats);
    } catch (err) {
      console.error('Coverage error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCityDetail = async (city: CityStats) => {
    setSelectedCity(city);
    setLoadingRestaurants(true);
    try {
      let all: any[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from('restaurants')
          .select('id, name, slug, is_active, claimed_by_owner_id, address, cuisines')
          .eq('city_id', city.id)
          .order('name')
          .range(from, from + 999);
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < 1000) break;
        from += 1000;
      }
      setCityRestaurants(all);
      setSelected(new Set());
    } catch (err) {
      console.error('Error fetching city restaurants:', err);
    } finally {
      setLoadingRestaurants(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === cityRestaurants.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(cityRestaurants.map(r => r.id)));
    }
  };

  const bulkDeactivate = async () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} restaurants deactiveren?`)) return;
    setExecuting(true);
    const ids = Array.from(selected);
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      await supabase.from('restaurants').update({ is_active: false }).in('id', chunk);
    }
    toast.success(`${ids.length} restaurants gedeactiveerd`);
    setSelected(new Set());
    setExecuting(false);
    if (selectedCity) openCityDetail(selectedCity);
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} restaurants PERMANENT verwijderen? Dit kan niet ongedaan worden!`)) return;
    if (!confirm(`Weet je het zeker? Alle gekoppelde gerechten, reviews en favorieten worden ook verwijderd.`)) return;
    setExecuting(true);
    const ids = Array.from(selected);
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      // Delete related data first
      await supabase.from('restaurant_dishes').delete().in('restaurant_id', chunk);
      await supabase.from('reviews').delete().in('restaurant_id', chunk);
      await supabase.from('favorites').delete().in('restaurant_id', chunk);
      await supabase.from('menu_items').delete().in('restaurant_id', chunk);
      await supabase.from('restaurants').delete().in('id', chunk);
    }
    toast.success(`${ids.length} restaurants verwijderd`);
    setSelected(new Set());
    setExecuting(false);
    if (selectedCity) openCityDetail(selectedCity);
  };

  const emptyCities = cityStats.filter(c => c.restaurantCount === 0);
  const lowCoverage = cityStats.filter(c => c.restaurantCount > 0 && c.coverageScore < 40);

  if (selectedCity) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedCity(null)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Restaurants in {selectedCity.name}
              </CardTitle>
              <CardDescription>
                {selectedCity.restaurantCount} restaurants • {selectedCity.activeCount} actief • {selectedCity.claimedCount} geclaimd
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingRestaurants ? (
            <div className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Bulk actions bar */}
              {selected.size > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Badge variant="outline">{selected.size} geselecteerd</Badge>
                  <div className="flex-1" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={bulkDeactivate}
                    disabled={executing}
                  >
                    <EyeOff className="h-3.5 w-3.5 mr-1" />
                    Deactiveren
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={bulkDelete}
                    disabled={executing}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Verwijderen
                  </Button>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selected.size === cityRestaurants.length && cityRestaurants.length > 0}
                        onCheckedChange={selectAll}
                      />
                    </TableHead>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Adres</TableHead>
                    <TableHead>Keukens</TableHead>
                    <TableHead className="text-center">Actief</TableHead>
                    <TableHead className="text-center">Geclaimd</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cityRestaurants.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggleSelect(r.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm">{r.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.address}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(r.cuisines || []).slice(0, 3).map(c => (
                            <Badge key={c} variant="outline" className="text-[10px] py-0">{c}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {r.is_active ? <CheckCircle className="h-4 w-4 text-green-600 mx-auto" /> : <XCircle className="h-4 w-4 text-destructive mx-auto" />}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.claimed_by_owner_id ? <CheckCircle className="h-4 w-4 text-green-600 mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(`/restaurant/${r.slug}`, '_blank')}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cityRestaurants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Geen restaurants in deze stad
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Geografische Dekking
        </CardTitle>
        <CardDescription>
          Restaurant-dichtheid en datakwaliteit per stad — klik op een stad om restaurants te zien
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Steden</p>
                <p className="text-2xl font-bold">{cityStats.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Totaal restaurants</p>
                <p className="text-2xl font-bold">{totalRestaurants}</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10">
                <p className="text-xs text-muted-foreground">Lege steden</p>
                <p className="text-2xl font-bold text-destructive">{emptyCities.length}</p>
              </div>
              <div className="p-3 rounded-lg bg-orange-500/10">
                <p className="text-xs text-muted-foreground">Lage dekking</p>
                <p className="text-2xl font-bold text-orange-600">{lowCoverage.length}</p>
              </div>
            </div>

            {emptyCities.length > 0 && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <p className="text-sm font-semibold text-destructive">Witte vlekken</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {emptyCities.map(c => (
                    <Badge key={c.id} variant="outline" className="text-destructive border-destructive/30">
                      {c.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stad</TableHead>
                  <TableHead className="text-right">Restaurants</TableHead>
                  <TableHead className="text-right">Actief</TableHead>
                  <TableHead className="text-right">Geclaimd</TableHead>
                  <TableHead className="text-right">Geocoded</TableHead>
                  <TableHead>Dekking</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cityStats.map(city => (
                  <TableRow key={city.id} className="cursor-pointer" onClick={() => openCityDetail(city)}>
                    <TableCell className="font-medium text-primary hover:underline">{city.name}</TableCell>
                    <TableCell className="text-right">{city.restaurantCount}</TableCell>
                    <TableCell className="text-right">{city.activeCount}</TableCell>
                    <TableCell className="text-right">{city.claimedCount}</TableCell>
                    <TableCell className="text-right">{city.withGeocoding}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress 
                          value={city.coverageScore} 
                          className="h-2 flex-1"
                        />
                        <span className={`text-xs font-medium ${
                          city.coverageScore >= 70 ? 'text-green-600' :
                          city.coverageScore >= 40 ? 'text-orange-600' : 'text-destructive'
                        }`}>
                          {city.coverageScore}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
