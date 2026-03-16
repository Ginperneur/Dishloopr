import { useState, useEffect } from 'react';
import { MapPin, Loader2, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

export function GeographicCoverage() {
  const [cityStats, setCityStats] = useState<CityStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalRestaurants, setTotalRestaurants] = useState(0);

  useEffect(() => {
    fetchCoverage();
  }, []);

  const fetchCoverage = async () => {
    setLoading(true);
    try {
      // Fetch all cities
      const { data: cities } = await supabase
        .from('cities')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');

      if (!cities) { setLoading(false); return; }

      // Fetch all restaurants in batches
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

      // Group by city
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
        // Coverage score: weighted average of geocoding, active %, and claimed %
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

  const emptyCities = cityStats.filter(c => c.restaurantCount === 0);
  const lowCoverage = cityStats.filter(c => c.restaurantCount > 0 && c.coverageScore < 40);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Geografische Dekking
        </CardTitle>
        <CardDescription>
          Restaurant-dichtheid en datakwaliteit per stad
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary cards */}
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

            {/* White spots alert */}
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

            {/* City table */}
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
                  <TableRow key={city.id}>
                    <TableCell className="font-medium">{city.name}</TableCell>
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
