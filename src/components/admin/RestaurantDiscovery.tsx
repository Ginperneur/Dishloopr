import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, MapPin, Sparkles, Check, X, RefreshCw, Star, ExternalLink, Zap, AlertCircle, RotateCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl } from 'date-fns/locale';

interface GridPoint {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  radius_meters: number;
  search_terms: string[];
  last_scanned_at: string | null;
  is_active: boolean;
  city_id: string;
}

interface DiscoveryResult {
  id: string;
  place_id: string;
  name: string;
  address: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  price_level: number | null;
  status: string;
  matched_restaurant_id: string | null;
  discovered_at: string;
  source_grid_point_id: string | null;
  photo_reference: string | null;
  city_id: string | null;
}

export function RestaurantDiscovery() {
  const [gridPoints, setGridPoints] = useState<GridPoint[]>([]);
  const [pendingResults, setPendingResults] = useState<DiscoveryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [stats, setStats] = useState({ pending: 0, approved: 0, duplicate: 0, rejected: 0, total: 0 });

  // Bulk scan state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkFilter, setBulkFilter] = useState<'never' | '7days' | '30days' | 'all'>('never');
  const [bulkType, setBulkType] = useState<'all' | 'grid' | 'hotspot'>('all');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, newCount: 0, dupCount: 0, errors: 0 });
  const [bulkCancelRequested, setBulkCancelRequested] = useState(false);

  // Reject dialog state
  const [rejectTarget, setRejectTarget] = useState<DiscoveryResult | null>(null);
  const [rejectReason, setRejectReason] = useState<'closed' | 'not_restaurant' | 'duplicate' | 'other'>('closed');

  // Rejected list
  const [rejectedResults, setRejectedResults] = useState<(DiscoveryResult & { reject_reason: string | null })[]>([]);

  // Cities for filter
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [gridCityFilter, setGridCityFilter] = useState<string>('all');
  const [queueCityFilter, setQueueCityFilter] = useState<string>('all');
  const [bulkCityFilter, setBulkCityFilter] = useState<string>('all');
  const [queueLimit, setQueueLimit] = useState<number>(100);

  const loadData = async () => {
    setLoading(true);
    let queueQuery = supabase
      .from('discovery_results')
      .select('*')
      .eq('status', 'pending')
      .order('discovered_at', { ascending: false })
      .limit(queueLimit);
    if (queueCityFilter !== 'all') {
      queueQuery = queueQuery.eq('city_id', queueCityFilter);
    }

    const [gpRes, resRes, rejRes, statsRes, citiesRes] = await Promise.all([
      supabase.from('discovery_grid_points').select('*').order('name'),
      queueQuery,
      supabase.from('discovery_results').select('*').eq('status', 'rejected').order('reviewed_at', { ascending: false }).limit(200),
      supabase.from('discovery_results').select('status'),
      supabase.from('cities').select('id, name').eq('is_active', true).order('name'),
    ]);

    if (citiesRes.data) setCities(citiesRes.data);
    if (gpRes.data) setGridPoints(gpRes.data as GridPoint[]);
    if (resRes.data) setPendingResults(resRes.data as DiscoveryResult[]);
    if (rejRes.data) setRejectedResults(rejRes.data as any);
    if (statsRes.data) {
      const s = { pending: 0, approved: 0, duplicate: 0, rejected: 0, total: statsRes.data.length };
      statsRes.data.forEach((r: any) => {
        if (r.status === 'pending') s.pending++;
        else if (r.status === 'approved') s.approved++;
        else if (r.status === 'duplicate') s.duplicate++;
        else if (r.status === 'rejected') (s as any).rejected++;
      });
      setStats(s as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueCityFilter, queueLimit]);

  const handleGenerateGrid = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_amsterdam_grid');
      if (error) throw error;
      toast.success(`${data} grid-punten gegenereerd voor Amsterdam`);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || 'Kon grid niet genereren');
    } finally {
      setGenerating(false);
    }
  };

  const handleScan = async (gridPointId: string) => {
    setScanning(gridPointId);
    try {
      const { data, error } = await supabase.functions.invoke('discover-restaurants', {
        body: { grid_point_id: gridPointId },
      });
      if (error) throw error;
      toast.success(`Scan voltooid: ${data.new_results} nieuw, ${data.duplicates} duplicaten (${data.api_calls_used} API calls)`);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || 'Scan mislukt');
    } finally {
      setScanning(null);
    }
  };

  // Compute which grid points match the bulk filter
  const bulkTargets = useMemo(() => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    return gridPoints.filter((gp) => {
      if (!gp.is_active) return false;
      if (bulkType !== 'all' && gp.type !== bulkType) return false;
      if (bulkCityFilter !== 'all' && gp.city_id !== bulkCityFilter) return false;
      const last = gp.last_scanned_at ? new Date(gp.last_scanned_at).getTime() : null;
      if (bulkFilter === 'never') return last === null;
      if (bulkFilter === '7days') return last === null || now - last > 7 * day;
      if (bulkFilter === '30days') return last === null || now - last > 30 * day;
      return true; // 'all'
    });
  }, [gridPoints, bulkFilter, bulkType, bulkCityFilter]);

  const handleBulkScan = async () => {
    if (bulkTargets.length === 0) {
      toast.error('Geen punten matchen je filter');
      return;
    }
    setBulkRunning(true);
    setBulkCancelRequested(false);
    setBulkProgress({ current: 0, total: bulkTargets.length, newCount: 0, dupCount: 0, errors: 0 });

    let newCount = 0;
    let dupCount = 0;
    let errors = 0;

    for (let i = 0; i < bulkTargets.length; i++) {
      if (bulkCancelRequested) {
        toast.info(`Geannuleerd na ${i} van ${bulkTargets.length} punten`);
        break;
      }
      const gp = bulkTargets[i];
      let attempt = 0;
      let lastErr: any = null;
      while (attempt < 3) {
        try {
          const { data, error } = await supabase.functions.invoke('discover-restaurants', {
            body: { grid_point_id: gp.id },
          });
          if (error) throw error;
          newCount += data?.new_results || 0;
          dupCount += data?.duplicates || 0;
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          attempt++;
          if (attempt < 3) {
            // Exponential backoff: 1.5s, 3s
            await new Promise((r) => setTimeout(r, 1500 * attempt));
          }
        }
      }
      if (lastErr) {
        console.error(`Bulk scan failed for ${gp.name} after 3 attempts:`, lastErr);
        errors++;
      }
      setBulkProgress({ current: i + 1, total: bulkTargets.length, newCount, dupCount, errors });
      // Throttle to avoid edge function cold-start / rate limiting
      if (i < bulkTargets.length - 1) await new Promise((r) => setTimeout(r, 1000));
    }

    setBulkRunning(false);
    toast.success(`Bulk scan klaar: ${newCount} nieuw, ${dupCount} duplicaten, ${errors} fouten`);
    await loadData();
  };


  const handleApprove = async (result: DiscoveryResult) => {
    try {
      // Get city slug for restaurant slug generation
      const { data: gridPoint } = await supabase
        .from('discovery_grid_points')
        .select('city_id, cities(slug)')
        .eq('id', result.source_grid_point_id!)
        .single();

      const cityId = gridPoint?.city_id;
      if (!cityId) throw new Error('City niet gevonden');

      // Generate slug
      const baseSlug = result.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60);
      const slug = `${baseSlug}-${result.place_id.slice(-6)}`;

      // Insert restaurant
      const { error: insErr } = await supabase.from('restaurants').insert({
        name: result.name,
        slug,
        address: result.address || 'Onbekend',
        city_id: cityId,
        google_place_id: result.place_id,
        geo_lat: (result as any).lat,
        geo_lng: (result as any).lng,
        google_rating: result.rating,
        google_reviews_count: result.user_ratings_total,
        price_level: result.price_level || 2,
        is_active: false, // Inactive until enriched
        added_by_source: 'discovery',
      });

      if (insErr) throw insErr;

      // Mark result approved
      await supabase
        .from('discovery_results')
        .update({ status: 'approved', reviewed_at: new Date().toISOString() })
        .eq('id', result.id);

      toast.success(`${result.name} toegevoegd (inactief, klaar voor verrijking)`);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || 'Goedkeuren mislukt');
    }
  };

  const handleReject = async (result: DiscoveryResult) => {
    setRejectTarget(result);
    setRejectReason('closed');
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    try {
      await supabase
        .from('discovery_results')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reject_reason: rejectReason,
        })
        .eq('id', rejectTarget.id);
      toast.success('Afgewezen — wordt niet opnieuw gescand');
      setRejectTarget(null);
      await loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRestore = async (result: DiscoveryResult) => {
    try {
      await supabase
        .from('discovery_results')
        .update({ status: 'pending', reviewed_at: null, reject_reason: null })
        .eq('id', result.id);
      toast.success('Teruggezet naar review queue');
      await loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Grid Punten</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{gridPoints.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>In Review Queue</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{stats.pending}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Goedgekeurd</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold text-foreground">{stats.approved}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Duplicaten</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold text-muted-foreground">{stats.duplicate}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Afgewezen</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{stats.rejected}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue={stats.pending > 0 ? 'queue' : 'grid'} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl">
          <TabsTrigger value="queue">Review Queue ({stats.pending})</TabsTrigger>
          <TabsTrigger value="grid">Grid Punten ({gridPoints.length})</TabsTrigger>
          <TabsTrigger value="rejected">Afgewezen ({stats.rejected})</TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Ontdekte Restaurants — Review Queue</CardTitle>
                <CardDescription>
                  Nieuwe restaurants gevonden via Google Places. Goedkeuren importeert ze als inactief (klaar voor AI-verrijking).
                  {stats.pending > pendingResults.length && (
                    <span className="block mt-1 text-xs">
                      Toont {pendingResults.length} van {stats.pending} — gebruik de stadfilter of laad meer.
                    </span>
                  )}
                </CardDescription>
              </div>
              <Select value={queueCityFilter} onValueChange={setQueueCityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter stad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle steden</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {pendingResults.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Geen pending resultaten {queueCityFilter !== 'all' ? 'voor deze stad' : ''}. Voer een scan uit op een grid-punt.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naam</TableHead>
                      <TableHead>Adres</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Ontdekt</TableHead>
                      <TableHead className="text-right">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingResults.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          <div>{r.name}</div>
                          <a
                            href={`https://www.google.com/maps/place/?q=place_id:${r.place_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                          >
                            Google Maps <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {r.address || '—'}
                        </TableCell>
                        <TableCell>
                          {r.rating ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Star className="h-3 w-3 fill-primary text-primary" />
                              {r.rating} ({r.user_ratings_total || 0})
                            </div>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(r.discovered_at), { addSuffix: true, locale: nl })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="default" onClick={() => handleApprove(r)}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleReject(r)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {pendingResults.length >= queueLimit && (
                <div className="flex justify-center pt-4">
                  <Button variant="outline" onClick={() => setQueueLimit((n) => n + 100)}>
                    Laad meer (+100)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grid" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle>Grid Configuratie</CardTitle>
                <CardDescription>Zoekpunten over de stad — elk punt scant ±1.5km radius</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {gridPoints.length > 0 && (
                  <Select value={gridCityFilter} onValueChange={setGridCityFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter stad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle steden</SelectItem>
                      {cities.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {gridPoints.length === 0 && (
                  <Button onClick={handleGenerateGrid} disabled={generating}>
                    {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                    Genereer Amsterdam Grid (40 punten)
                  </Button>
                )}
                {gridPoints.length > 0 && (
                  <Button onClick={() => setBulkOpen(true)} variant="default">
                    <Zap className="h-4 w-4 mr-2" />
                    Bulk Scan
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {gridPoints.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MapPin className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nog geen grid-punten. Genereer het Amsterdam grid om te starten.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naam</TableHead>
                      <TableHead>Stad</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Locatie</TableHead>
                      <TableHead>Radius</TableHead>
                      <TableHead>Laatste Scan</TableHead>
                      <TableHead className="text-right">Actie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gridPoints
                      .filter((gp) => gridCityFilter === 'all' || gp.city_id === gridCityFilter)
                      .map((gp) => (
                      <TableRow key={gp.id}>
                        <TableCell className="font-medium">{gp.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {cities.find((c) => c.id === gp.city_id)?.name || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={gp.type === 'hotspot' ? 'default' : 'secondary'}>
                            {gp.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {Number(gp.lat).toFixed(4)}, {Number(gp.lng).toFixed(4)}
                        </TableCell>
                        <TableCell>{gp.radius_meters}m</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {gp.last_scanned_at
                            ? formatDistanceToNow(new Date(gp.last_scanned_at), { addSuffix: true, locale: nl })
                            : 'Nooit'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleScan(gp.id)}
                            disabled={scanning === gp.id}
                          >
                            {scanning === gp.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Afgewezen Restaurants</CardTitle>
              <CardDescription>
                Deze worden bij volgende scans automatisch overgeslagen. Klik op herstellen om terug te zetten naar de review queue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rejectedResults.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <X className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Nog geen afgewezen restaurants.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naam</TableHead>
                      <TableHead>Adres</TableHead>
                      <TableHead>Reden</TableHead>
                      <TableHead>Afgewezen</TableHead>
                      <TableHead className="text-right">Actie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rejectedResults.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          <div>{r.name}</div>
                          <a
                            href={`https://www.google.com/maps/place/?q=place_id:${r.place_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                          >
                            Google Maps <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {r.address || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {r.reject_reason === 'closed' && 'Gesloten'}
                            {r.reject_reason === 'not_restaurant' && 'Geen restaurant'}
                            {r.reject_reason === 'duplicate' && 'Dubbel'}
                            {r.reject_reason === 'other' && 'Anders'}
                            {!r.reject_reason && '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {(r as any).reviewed_at
                            ? formatDistanceToNow(new Date((r as any).reviewed_at), { addSuffix: true, locale: nl })
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => handleRestore(r)}>
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Herstellen
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bulk Scan Dialog */}
      <Dialog open={bulkOpen} onOpenChange={(o) => !bulkRunning && setBulkOpen(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Bulk Scan
            </DialogTitle>
            <DialogDescription>
              Scan meerdere grid-punten tegelijk. Bestaande place_id's worden automatisch overgeslagen — geen duplicaten.
            </DialogDescription>
          </DialogHeader>

          {!bulkRunning ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Welke punten scannen?</label>
                <Select value={bulkFilter} onValueChange={(v: any) => setBulkFilter(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Nooit gescand (aanbevolen voor 1e run)</SelectItem>
                    <SelectItem value="30days">Niet gescand in laatste 30 dagen</SelectItem>
                    <SelectItem value="7days">Niet gescand in laatste 7 dagen</SelectItem>
                    <SelectItem value="all">Alle actieve punten (forceer rescan)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select value={bulkType} onValueChange={(v: any) => setBulkType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle types</SelectItem>
                    <SelectItem value="grid">Alleen grid-punten</SelectItem>
                    <SelectItem value="hotspot">Alleen hotspots</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Punten geselecteerd</span>
                  <span className="font-bold text-lg text-primary">{bulkTargets.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Geschatte API-kosten</span>
                  <span>~${(bulkTargets.length * 0.034).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Geschatte duur</span>
                  <span>~{Math.ceil(bulkTargets.length * 2.5 / 60)} min</span>
                </div>
              </div>

              {bulkTargets.length === 0 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted text-sm">
                  <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span>Geen punten matchen je filter. Probeer een ander filter.</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Scannen... {bulkProgress.current} van {bulkProgress.total}
                </p>
              </div>
              <Progress value={(bulkProgress.current / bulkProgress.total) * 100} />
              <div className="grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg border p-2">
                  <div className="text-2xl font-bold text-primary">{bulkProgress.newCount}</div>
                  <div className="text-xs text-muted-foreground">Nieuw</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-2xl font-bold text-muted-foreground">{bulkProgress.dupCount}</div>
                  <div className="text-xs text-muted-foreground">Duplicaat</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-2xl font-bold text-destructive">{bulkProgress.errors}</div>
                  <div className="text-xs text-muted-foreground">Fouten</div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {!bulkRunning ? (
              <>
                <Button variant="outline" onClick={() => setBulkOpen(false)}>Annuleren</Button>
                <Button onClick={handleBulkScan} disabled={bulkTargets.length === 0}>
                  <Zap className="h-4 w-4 mr-2" />
                  Start bulk scan ({bulkTargets.length})
                </Button>
              </>
            ) : (
              <Button variant="destructive" onClick={() => setBulkCancelRequested(true)}>
                Stop na huidig punt
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Restaurant afwijzen</DialogTitle>
            <DialogDescription>
              <strong>{rejectTarget?.name}</strong> wordt bij volgende scans automatisch overgeslagen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Reden</label>
            <Select value={rejectReason} onValueChange={(v) => setRejectReason(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="closed">Gesloten / niet meer bestaand</SelectItem>
                <SelectItem value="not_restaurant">Geen restaurant</SelectItem>
                <SelectItem value="duplicate">Dubbel (al in database)</SelectItem>
                <SelectItem value="other">Anders / niet relevant</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Annuleren</Button>
            <Button variant="destructive" onClick={confirmReject}>
              <X className="h-4 w-4 mr-1" />
              Afwijzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
