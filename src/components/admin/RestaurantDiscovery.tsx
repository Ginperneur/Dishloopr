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
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, MapPin, Sparkles, Check, X, RefreshCw, Star, ExternalLink, Zap, AlertCircle, RotateCcw, Search } from 'lucide-react';
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
  venue_category?: string | null;
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

  // Bulk reject by min reviews
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectMinReviews, setBulkRejectMinReviews] = useState<number>(10);
  const [bulkRejectIncludeNull, setBulkRejectIncludeNull] = useState<boolean>(true);
  const [bulkRejectRunning, setBulkRejectRunning] = useState(false);
  const [bulkRejectPreview, setBulkRejectPreview] = useState<number | null>(null);

  // Pipeline state
  const [approving, setApproving] = useState<string | null>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState({ current: 0, total: 0, dishes: 0, errors: 0 });
  const [pipelineCancel, setPipelineCancel] = useState(false);
  const [pipelineMode, setPipelineMode] = useState<'pending' | 'enrich_existing'>('pending');

  // Rejected list
  const [rejectedResults, setRejectedResults] = useState<(DiscoveryResult & { reject_reason: string | null })[]>([]);

  // Cities for filter
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [gridCityFilter, setGridCityFilter] = useState<string>('all');
  const [queueCityFilter, setQueueCityFilter] = useState<string>('all');
  const [bulkCityFilter, setBulkCityFilter] = useState<string>('all');
  const [queueLimit, setQueueLimit] = useState<number>(100);
  const [queueCategoryFilter, setQueueCategoryFilter] = useState<'all' | 'restaurant' | 'cafe' | 'bakery'>('all');
  const [bulkCategories, setBulkCategories] = useState<Array<'restaurant' | 'cafe' | 'bakery'>>(['restaurant', 'cafe', 'bakery']);

  // Search + multi-select for queue
  const [queueSearch, setQueueSearch] = useState<string>('');
  const SELECTION_STORAGE_KEY = 'discovery_selected_ids';
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(SELECTION_STORAGE_KEY) : null;
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
      return new Set();
    }
  });
  const [bulkSelectionRunning, setBulkSelectionRunning] = useState(false);

  // Persist selection across refresh / navigation
  useEffect(() => {
    try {
      localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(Array.from(selectedIds)));
    } catch {}
  }, [selectedIds]);

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
    if (queueCategoryFilter !== 'all') {
      queueQuery = queueQuery.eq('venue_category', queueCategoryFilter);
    }
    const qSearch = queueSearch.trim();
    if (qSearch) {
      const safe = qSearch.replace(/[%,]/g, ' ');
      queueQuery = queueQuery.or(`name.ilike.%${safe}%,address.ilike.%${safe}%`);
    }

    // Accurate counts (head:true bypasses 1000-row cap)
    const countByStatus = async (status: string) => {
      const { count } = await supabase
        .from('discovery_results')
        .select('*', { count: 'exact', head: true })
        .eq('status', status);
      return count || 0;
    };

    const [gpRes, resRes, rejRes, citiesRes, pendingCount, approvedCount, duplicateCount, rejectedCount] = await Promise.all([
      supabase.from('discovery_grid_points').select('*').order('name'),
      queueQuery,
      supabase.from('discovery_results').select('*').eq('status', 'rejected').order('reviewed_at', { ascending: false }).limit(200),
      supabase.from('cities').select('id, name').eq('is_active', true).order('name'),
      countByStatus('pending'),
      countByStatus('approved'),
      countByStatus('duplicate'),
      countByStatus('rejected'),
    ]);

    if (citiesRes.data) setCities(citiesRes.data);
    if (gpRes.data) setGridPoints(gpRes.data as GridPoint[]);
    if (resRes.data) setPendingResults(resRes.data as DiscoveryResult[]);
    if (rejRes.data) setRejectedResults(rejRes.data as any);
    setStats({
      pending: pendingCount,
      approved: approvedCount,
      duplicate: duplicateCount,
      rejected: rejectedCount,
      total: pendingCount + approvedCount + duplicateCount + rejectedCount,
    } as any);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueCityFilter, queueLimit, queueCategoryFilter, queueSearch]);

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
        body: { grid_point_id: gridPointId, categories: bulkCategories },
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
            body: { grid_point_id: gp.id, categories: bulkCategories },
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
    setApproving(result.id);
    try {
      const { data, error } = await supabase.functions.invoke('approve-discovery-restaurant', {
        body: { discoveryResultId: result.id },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Pipeline mislukt');
      toast.success(`${result.name}: ${data.dishesAdded} gerechten, ${data.steps?.filter((s: any) => s.ok).length}/${data.steps?.length} stappen ok`);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || 'Goedkeuren mislukt');
    } finally {
      setApproving(null);
    }
  };

  const runPipelineBatch = async (modeOverride?: 'pending' | 'enrich_existing') => {
    setPipelineRunning(true);
    setPipelineCancel(false);
    let dishes = 0;
    let errors = 0;

    let targets: Array<{ id: string; name: string; payload: any }> = [];

    const mode = modeOverride ?? pipelineMode;
    if (mode === 'pending') {
      // Approve all pending in current city filter
      let q = supabase
        .from('discovery_results')
        .select('id, name, place_id')
        .eq('status', 'pending')
        .order('discovered_at', { ascending: false })
        .limit(500);
      if (queueCityFilter !== 'all') q = q.eq('city_id', queueCityFilter);
      const { data } = await q;
      targets = (data || []).map((r) => ({ id: r.id, name: r.name, payload: { discoveryResultId: r.id } }));
    } else {
      // Enrich already-approved discovery restaurants that lack website/menu
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, website_url')
        .eq('added_by_source', 'discovery')
        .or('website_url.is.null,is_active.eq.false')
        .limit(500);
      targets = (data || []).map((r) => ({ id: r.id, name: r.name, payload: { restaurantId: r.id } }));
    }

    setPipelineProgress({ current: 0, total: targets.length, dishes: 0, errors: 0 });

    for (let i = 0; i < targets.length; i++) {
      if (pipelineCancel) break;
      const t = targets[i];
      try {
        const { data, error } = await supabase.functions.invoke('approve-discovery-restaurant', {
          body: t.payload,
        });
        if (error || !data?.success) {
          errors++;
        } else {
          dishes += data.dishesAdded || 0;
        }
      } catch {
        errors++;
      }
      setPipelineProgress({ current: i + 1, total: targets.length, dishes, errors });
      await new Promise((r) => setTimeout(r, 600));
    }

    setPipelineRunning(false);
    toast.success(`Pipeline klaar: ${dishes} gerechten toegevoegd, ${errors} fouten`);
    await loadData();
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

  // ---- Multi-select bulk actions on filtered queue ----
  const filteredPending = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    if (!q) return pendingResults;
    return pendingResults.filter((r) =>
      r.name.toLowerCase().includes(q) ||
      (r.address || '').toLowerCase().includes(q)
    );
  }, [pendingResults, queueSearch]);

  const allFilteredSelected = filteredPending.length > 0 && filteredPending.every((r) => selectedIds.has(r.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredPending.forEach((r) => next.delete(r.id));
      } else {
        filteredPending.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const approveSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Weet je zeker dat je ${ids.length} restaurant(s) wilt goedkeuren? Dit start de volledige pipeline.`)) return;
    setBulkSelectionRunning(true);
    setPipelineRunning(true);
    setPipelineCancel(false);
    setPipelineProgress({ current: 0, total: ids.length, dishes: 0, errors: 0 });
    let dishes = 0;
    let errors = 0;
    for (let i = 0; i < ids.length; i++) {
      if (pipelineCancel) break;
      try {
        const { data, error } = await supabase.functions.invoke('approve-discovery-restaurant', {
          body: { discoveryResultId: ids[i] },
        });
        if (error || !data?.success) errors++;
        else dishes += data.dishesAdded || 0;
      } catch {
        errors++;
      }
      setPipelineProgress({ current: i + 1, total: ids.length, dishes, errors });
      await new Promise((r) => setTimeout(r, 600));
    }
    setPipelineRunning(false);
    setBulkSelectionRunning(false);
    clearSelection();
    toast.success(`Klaar: ${dishes} gerechten, ${errors} fouten`);
    await loadData();
  };

  const rejectSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Weet je zeker dat je ${ids.length} restaurant(s) wilt afwijzen?`)) return;
    setBulkSelectionRunning(true);
    try {
      const { error } = await supabase
        .from('discovery_results')
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
          reject_reason: 'other',
        })
        .in('id', ids);
      if (error) throw error;
      toast.success(`${ids.length} afgewezen`);
      clearSelection();
      await loadData();
    } catch (e: any) {
      toast.error(e.message || 'Bulk afwijzen mislukt');
    } finally {
      setBulkSelectionRunning(false);
    }
  };

  const previewBulkReject = async () => {
    try {
      let countLow = 0;
      let countNull = 0;

      let qLow = supabase
        .from('discovery_results')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lt('user_ratings_total', bulkRejectMinReviews);
      if (queueCityFilter !== 'all') qLow = qLow.eq('city_id', queueCityFilter);
      const { count: cLow, error: eLow } = await qLow;
      if (eLow) throw eLow;
      countLow = cLow ?? 0;

      if (bulkRejectIncludeNull) {
        let qNull = supabase
          .from('discovery_results')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
          .is('user_ratings_total', null);
        if (queueCityFilter !== 'all') qNull = qNull.eq('city_id', queueCityFilter);
        const { count: cNull, error: eNull } = await qNull;
        if (eNull) throw eNull;
        countNull = cNull ?? 0;
      }
      setBulkRejectPreview(countLow + countNull);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const confirmBulkReject = async () => {
    setBulkRejectRunning(true);
    try {
      const payload = {
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reject_reason: `low_reviews_lt_${bulkRejectMinReviews}`,
      };
      let total = 0;

      let qLow = supabase
        .from('discovery_results')
        .update(payload)
        .eq('status', 'pending')
        .lt('user_ratings_total', bulkRejectMinReviews);
      if (queueCityFilter !== 'all') qLow = qLow.eq('city_id', queueCityFilter);
      const { data: dLow, error: eLow } = await qLow.select('id');
      if (eLow) throw eLow;
      total += dLow?.length ?? 0;

      if (bulkRejectIncludeNull) {
        let qNull = supabase
          .from('discovery_results')
          .update(payload)
          .eq('status', 'pending')
          .is('user_ratings_total', null);
        if (queueCityFilter !== 'all') qNull = qNull.eq('city_id', queueCityFilter);
        const { data: dNull, error: eNull } = await qNull.select('id');
        if (eNull) throw eNull;
        total += dNull?.length ?? 0;
      }

      toast.success(`${total} restaurants afgewezen`);
      setBulkRejectOpen(false);
      setBulkRejectPreview(null);
      await loadData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBulkRejectRunning(false);
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
                  Nieuwe restaurants gevonden via Google Places. Goedkeuren = volledige pipeline: import → verrijk → AI-classificeer → menu scrapen → activeren.
                  {stats.pending > pendingResults.length && (
                    <span className="block mt-1 text-xs">
                      Toont {pendingResults.length} van {stats.pending.toLocaleString('nl-NL')} — laad meer hieronder.
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
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
                <Select value={queueCategoryFilter} onValueChange={(v: any) => setQueueCategoryFilter(v)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle types</SelectItem>
                    <SelectItem value="restaurant">Restaurants</SelectItem>
                    <SelectItem value="cafe">Koffie / Lunch / Brasserie</SelectItem>
                    <SelectItem value="bakery">Bakkerijen</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="default"
                  disabled={pipelineRunning || stats.pending === 0}
                  onClick={() => { setPipelineMode('pending'); runPipelineBatch('pending'); }}
                >
                  <Zap className="h-4 w-4 mr-1" />
                  Bulk goedkeuren ({queueCityFilter !== 'all' ? 'stad' : 'alles'})
                </Button>
                <Button
                  variant="outline"
                  disabled={pipelineRunning}
                  onClick={() => { setPipelineMode('enrich_existing'); runPipelineBatch('enrich_existing'); }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Verrijk reeds goedgekeurde
                </Button>
                <Button
                  variant="destructive"
                  disabled={pipelineRunning || stats.pending === 0}
                  onClick={() => { setBulkRejectPreview(null); setBulkRejectOpen(true); }}
                >
                  <X className="h-4 w-4 mr-1" />
                  Bulk afwijzen (weinig reviews)
                </Button>
              </div>
            </CardHeader>
            {pipelineRunning && (
              <CardContent className="border-t bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">
                    Pipeline: {pipelineProgress.current}/{pipelineProgress.total} • {pipelineProgress.dishes} gerechten • {pipelineProgress.errors} fouten
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setPipelineCancel(true)}>Stop</Button>
                </div>
                <Progress value={pipelineProgress.total > 0 ? (pipelineProgress.current / pipelineProgress.total) * 100 : 0} />
              </CardContent>
            )}
            <CardContent>
              {/* Zoekbalk + selectie-acties */}
              <div className="flex flex-col sm:flex-row gap-2 mb-4 items-stretch sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Zoek op naam of adres..."
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{selectedIds.size} geselecteerd</Badge>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={bulkSelectionRunning || pipelineRunning}
                      onClick={approveSelected}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Goedkeuren
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={bulkSelectionRunning}
                      onClick={rejectSelected}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Afwijzen
                    </Button>
                    <Button size="sm" variant="ghost" onClick={clearSelection}>
                      Wis selectie
                    </Button>
                  </div>
                )}
              </div>
              {filteredPending.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>
                    {queueSearch
                      ? `Geen resultaten voor "${queueSearch}".`
                      : `Geen pending resultaten ${queueCityFilter !== 'all' ? 'voor deze stad' : ''}. Voer een scan uit op een grid-punt.`}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={toggleSelectAllFiltered}
                          aria-label="Selecteer alles"
                        />
                      </TableHead>
                      <TableHead>Naam</TableHead>
                    <TableHead>Type</TableHead>
                      <TableHead>Adres</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead>Ontdekt</TableHead>
                      <TableHead className="text-right">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPending.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(r.id)}
                            onCheckedChange={() => toggleSelect(r.id)}
                            aria-label={`Selecteer ${r.name}`}
                          />
                        </TableCell>
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
                      <TableCell>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          {r.venue_category === 'cafe' && 'Koffie/Lunch'}
                          {r.venue_category === 'bakery' && 'Bakkerij'}
                          {(!r.venue_category || r.venue_category === 'restaurant') && 'Restaurant'}
                        </Badge>
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
                            <Button size="sm" variant="default" disabled={approving === r.id} onClick={() => handleApprove(r)}>
                              {approving === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            </Button>
                            <Button size="sm" variant="outline" disabled={approving === r.id} onClick={() => handleReject(r)}>
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Stad</label>
                <Select value={bulkCityFilter} onValueChange={setBulkCityFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle steden</SelectItem>
                    {cities.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Wat zoeken?</label>
                <div className="flex flex-col gap-2 rounded-md border p-3">
                  {([
                    { key: 'restaurant', label: 'Restaurants' },
                    { key: 'cafe', label: 'Koffietentjes / Lunchrooms / Brasseries' },
                    { key: 'bakery', label: 'Bakkerijen' },
                  ] as const).map((opt) => (
                    <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bulkCategories.includes(opt.key)}
                        onChange={(e) => {
                          setBulkCategories((prev) =>
                            e.target.checked
                              ? Array.from(new Set([...prev, opt.key]))
                              : prev.filter((c) => c !== opt.key)
                          );
                        }}
                      />
                      {opt.label}
                    </label>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Tip: meer categorieën = meer Google API calls per grid-punt.
                  </p>
                </div>
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

      {/* Bulk Reject by min reviews */}
      <Dialog open={bulkRejectOpen} onOpenChange={(o) => { if (!o) { setBulkRejectOpen(false); setBulkRejectPreview(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk afwijzen op aantal reviews</DialogTitle>
            <DialogDescription>
              Wijst alle pending restaurants af met minder dan het opgegeven aantal Google reviews
              {queueCityFilter !== 'all' ? ' (alleen geselecteerde stad)' : ' (alle steden)'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Minimum aantal reviews</label>
              <input
                type="number"
                min={0}
                value={bulkRejectMinReviews}
                onChange={(e) => { setBulkRejectMinReviews(parseInt(e.target.value) || 0); setBulkRejectPreview(null); }}
                className="mt-1 w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Restaurants met minder dan {bulkRejectMinReviews} reviews worden afgewezen.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bulkRejectIncludeNull}
                onChange={(e) => { setBulkRejectIncludeNull(e.target.checked); setBulkRejectPreview(null); }}
              />
              Ook restaurants zonder review-data meenemen
            </label>
            <Button variant="outline" size="sm" onClick={previewBulkReject} disabled={bulkRejectRunning}>
              Aantal voorbekijken
            </Button>
            {bulkRejectPreview !== null && (
              <div className="p-3 rounded-md bg-muted text-sm">
                <strong>{bulkRejectPreview.toLocaleString('nl-NL')}</strong> restaurants worden afgewezen.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkRejectOpen(false); setBulkRejectPreview(null); }} disabled={bulkRejectRunning}>
              Annuleren
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkReject}
              disabled={bulkRejectRunning || bulkRejectPreview === 0}
            >
              {bulkRejectRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
              Definitief afwijzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
