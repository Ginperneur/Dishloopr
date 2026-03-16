import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ShieldAlert, Eye, Trash2, RefreshCw, MapPin, ImageOff, UtensilsCrossed, Copy, Ban, CheckCircle2, RotateCcw, XCircle, Undo2, Wand2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AuditRestaurant {
  id: string;
  name: string;
  slug: string;
  address: string;
  city_name: string;
  is_active: boolean;
  rating: number;
  review_count: number;
  created_at: string;
  website_url: string | null;
  phone: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  images: string[] | null;
  cuisines: string[] | null;
  dish_count: number;
  flags: AuditFlag[];
  risk_score: number;
}

interface AuditFlag {
  type: 'critical' | 'warning' | 'info';
  label: string;
  detail: string;
}

type FilterLevel = 'all' | 'critical' | 'warning' | 'clean' | 'approved' | 'rejected';

const APPROVED_STORAGE_KEY = 'dishloopr_audit_approved';
const REJECTED_STORAGE_KEY = 'dishloopr_audit_rejected';

function getStoredIds(key: string): Set<string> {
  try {
    const stored = localStorage.getItem(key);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
}

function saveStoredIds(key: string, ids: Set<string>) {
  localStorage.setItem(key, JSON.stringify([...ids]));
}

export function RestaurantAudit() {
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<AuditRestaurant[]>([]);
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('all');
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(() => getStoredIds(APPROVED_STORAGE_KEY));
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(() => getStoredIds(REJECTED_STORAGE_KEY));

  useEffect(() => {
    runAudit();
  }, []);

  const runAudit = async () => {
    setLoading(true);

    // Fetch all restaurants with city name
    const { data: allRestaurants } = await supabase
      .from('restaurants')
      .select('id, name, slug, address, is_active, rating, review_count, created_at, website_url, phone, geo_lat, geo_lng, images, cuisines, cities:city_id(name)')
      .order('created_at', { ascending: false });

    if (!allRestaurants) {
      setLoading(false);
      return;
    }

    // Fetch dish counts per restaurant in batch
    const { data: dishCounts } = await supabase
      .from('restaurant_dishes')
      .select('restaurant_id')
      .neq('status', 'rejected');

    const dishCountMap = new Map<string, number>();
    (dishCounts || []).forEach((d: any) => {
      dishCountMap.set(d.restaurant_id, (dishCountMap.get(d.restaurant_id) || 0) + 1);
    });

    // Build address frequency map for duplicate detection
    const addressMap = new Map<string, string[]>();
    allRestaurants.forEach((r: any) => {
      const normAddr = r.address?.toLowerCase().trim();
      if (normAddr) {
        const existing = addressMap.get(normAddr) || [];
        existing.push(r.id);
        addressMap.set(normAddr, existing);
      }
    });

    // Build name frequency map for duplicate detection
    const nameMap = new Map<string, string[]>();
    allRestaurants.forEach((r: any) => {
      const normName = r.name?.toLowerCase().trim();
      if (normName) {
        const existing = nameMap.get(normName) || [];
        existing.push(r.id);
        nameMap.set(normName, existing);
      }
    });

    // Score each restaurant
    const audited: AuditRestaurant[] = allRestaurants.map((r: any) => {
      const flags: AuditFlag[] = [];
      let riskScore = 0;
      const dishCount = dishCountMap.get(r.id) || 0;
      const normAddr = r.address?.toLowerCase().trim();
      const normName = r.name?.toLowerCase().trim();

      // CRITICAL flags (3 pts each)
      if (!r.address || r.address.trim().length < 5) {
        flags.push({ type: 'critical', label: 'Geen adres', detail: 'Restaurant heeft geen geldig adres' });
        riskScore += 3;
      }

      const dupeAddr = normAddr ? (addressMap.get(normAddr) || []) : [];
      if (dupeAddr.length > 1) {
        flags.push({ type: 'critical', label: 'Dubbel adres', detail: `${dupeAddr.length} restaurants op hetzelfde adres` });
        riskScore += 3;
      }

      const dupeName = normName ? (nameMap.get(normName) || []) : [];
      if (dupeName.length > 1) {
        flags.push({ type: 'critical', label: 'Dubbele naam', detail: `${dupeName.length}x dezelfde naam in database` });
        riskScore += 3;
      }

      // WARNING flags (2 pts each)
      if (!r.phone && !r.website_url) {
        flags.push({ type: 'warning', label: 'Geen contact', detail: 'Geen telefoon én geen website' });
        riskScore += 2;
      }

      if (!r.geo_lat || !r.geo_lng) {
        flags.push({ type: 'warning', label: 'Geen coördinaten', detail: 'Restaurant is niet gegeocodeerd' });
        riskScore += 2;
      }

      if (!r.images || r.images.length === 0) {
        flags.push({ type: 'warning', label: 'Geen foto\'s', detail: 'Geen afbeeldingen gekoppeld' });
        riskScore += 2;
      }

      if (dishCount === 0) {
        flags.push({ type: 'warning', label: 'Geen gerechten', detail: 'Geen gerechten aan restaurant gekoppeld' });
        riskScore += 2;
      }

      if (!r.cuisines || r.cuisines.length === 0) {
        flags.push({ type: 'warning', label: 'Geen keuken', detail: 'Geen keukentype opgegeven' });
        riskScore += 1;
      }

      // INFO flags (1 pt each)
      if (r.rating === 0 && r.review_count === 0) {
        flags.push({ type: 'info', label: 'Geen reviews', detail: 'Nog geen enkele review ontvangen' });
        riskScore += 1;
      }

      // Suspicious name patterns
      const suspiciousPatterns = /test|fake|demo|xxx|asdf|qwerty/i;
      if (suspiciousPatterns.test(r.name)) {
        flags.push({ type: 'critical', label: 'Verdachte naam', detail: `Naam bevat verdacht patroon: "${r.name}"` });
        riskScore += 3;
      }

      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        address: r.address,
        city_name: (r.cities as any)?.name || 'Onbekend',
        is_active: r.is_active,
        rating: Number(r.rating),
        review_count: r.review_count,
        created_at: r.created_at,
        website_url: r.website_url,
        phone: r.phone,
        geo_lat: r.geo_lat,
        geo_lng: r.geo_lng,
        images: r.images,
        cuisines: r.cuisines,
        dish_count: dishCount,
        flags,
        risk_score: riskScore,
      };
    });

    // Sort by risk score descending
    audited.sort((a, b) => b.risk_score - a.risk_score);
    setRestaurants(audited);
    setLoading(false);
  };

  const handleApprove = (id: string) => {
    const nextApproved = new Set(approvedIds);
    nextApproved.add(id);
    // Remove from rejected if it was there
    const nextRejected = new Set(rejectedIds);
    nextRejected.delete(id);
    setApprovedIds(nextApproved);
    setRejectedIds(nextRejected);
    saveStoredIds(APPROVED_STORAGE_KEY, nextApproved);
    saveStoredIds(REJECTED_STORAGE_KEY, nextRejected);
    toast.success('Restaurant goedgekeurd');
  };

  const handleReject = (id: string) => {
    const nextRejected = new Set(rejectedIds);
    nextRejected.add(id);
    // Remove from approved if it was there
    const nextApproved = new Set(approvedIds);
    nextApproved.delete(id);
    setRejectedIds(nextRejected);
    setApprovedIds(nextApproved);
    saveStoredIds(REJECTED_STORAGE_KEY, nextRejected);
    saveStoredIds(APPROVED_STORAGE_KEY, nextApproved);
    toast.success('Restaurant gemarkeerd als geweigerd');
  };

  const handleUndoDecision = (id: string) => {
    const nextApproved = new Set(approvedIds);
    const nextRejected = new Set(rejectedIds);
    nextApproved.delete(id);
    nextRejected.delete(id);
    setApprovedIds(nextApproved);
    setRejectedIds(nextRejected);
    saveStoredIds(APPROVED_STORAGE_KEY, nextApproved);
    saveStoredIds(REJECTED_STORAGE_KEY, nextRejected);
    toast.success('Beslissing ongedaan gemaakt');
  };

  const handleResetAll = () => {
    setApprovedIds(new Set());
    setRejectedIds(new Set());
    saveStoredIds(APPROVED_STORAGE_KEY, new Set());
    saveStoredIds(REJECTED_STORAGE_KEY, new Set());
    toast.success('Alle beslissingen gereset');
  };

  const filtered = useMemo(() => {
    switch (filterLevel) {
      case 'critical': {
        const pool = restaurants.filter(r => !approvedIds.has(r.id) && !rejectedIds.has(r.id));
        return pool.filter(r => r.risk_score >= 6);
      }
      case 'warning': {
        const pool = restaurants.filter(r => !approvedIds.has(r.id) && !rejectedIds.has(r.id));
        return pool.filter(r => r.risk_score >= 2 && r.risk_score < 6);
      }
      case 'clean': {
        const pool = restaurants.filter(r => !approvedIds.has(r.id) && !rejectedIds.has(r.id));
        return pool.filter(r => r.risk_score === 0);
      }
      case 'approved':
        return restaurants.filter(r => approvedIds.has(r.id));
      case 'rejected':
        return restaurants.filter(r => rejectedIds.has(r.id));
      default: {
        const pool = restaurants.filter(r => !approvedIds.has(r.id) && !rejectedIds.has(r.id));
        return pool.filter(r => r.risk_score > 0);
      }
    }
  }, [restaurants, filterLevel, approvedIds, rejectedIds]);

  const stats = useMemo(() => {
    const pending = restaurants.filter(r => !approvedIds.has(r.id) && !rejectedIds.has(r.id));
    return {
      total: restaurants.length,
      approved: approvedIds.size,
      rejected: rejectedIds.size,
      critical: pending.filter(r => r.risk_score >= 6).length,
      warning: pending.filter(r => r.risk_score >= 2 && r.risk_score < 6).length,
      clean: pending.filter(r => r.risk_score === 0).length,
    };
  }, [restaurants, approvedIds, rejectedIds]);

  const handleDeactivate = async (id: string) => {
    setDeactivating(id);
    const { error } = await supabase
      .from('restaurants')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      toast.error('Fout bij deactiveren');
    } else {
      toast.success('Restaurant gedeactiveerd');
      setRestaurants(prev =>
        prev.map(r => r.id === id ? { ...r, is_active: false } : r)
      );
    }
    setDeactivating(null);
  };

  const getRiskBadge = (score: number) => {
    if (score >= 6) return <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" />Hoog risico</Badge>;
    if (score >= 2) return <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-700 dark:text-yellow-400"><AlertTriangle className="h-3 w-3" />Let op</Badge>;
    return <Badge variant="outline" className="gap-1 text-emerald-600">OK</Badge>;
  };

  const getFlagIcon = (type: AuditFlag['type']) => {
    switch (type) {
      case 'critical': return <ShieldAlert className="h-3 w-3 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-3 w-3 text-yellow-500" />;
      case 'info': return <Eye className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Audit wordt uitgevoerd over {restaurants.length || '...'} restaurants...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <Card className={`cursor-pointer hover:border-primary/50 transition-colors ${filterLevel === 'all' ? 'border-primary' : ''}`} onClick={() => setFilterLevel('all')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Totaal</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:border-destructive/50 transition-colors border-destructive/20 ${filterLevel === 'critical' ? 'border-destructive' : ''}`} onClick={() => setFilterLevel('critical')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.critical}</p>
            <p className="text-xs text-muted-foreground">Hoog risico</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:border-yellow-500/50 transition-colors border-yellow-500/20 ${filterLevel === 'warning' ? 'border-yellow-500' : ''}`} onClick={() => setFilterLevel('warning')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.warning}</p>
            <p className="text-xs text-muted-foreground">Waarschuwing</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:border-emerald-500/50 transition-colors border-emerald-500/20 ${filterLevel === 'clean' ? 'border-emerald-500' : ''}`} onClick={() => setFilterLevel('clean')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.clean}</p>
            <p className="text-xs text-muted-foreground">Schoon</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:border-primary/50 transition-colors border-primary/20 ${filterLevel === 'approved' ? 'border-primary' : ''}`} onClick={() => setFilterLevel('approved')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.approved}</p>
            <p className="text-xs text-muted-foreground">Goedgekeurd</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer hover:border-destructive/50 transition-colors border-destructive/20 ${filterLevel === 'rejected' ? 'border-destructive' : ''}`} onClick={() => setFilterLevel('rejected')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.rejected}</p>
            <p className="text-xs text-muted-foreground">Geweigerd</p>
          </CardContent>
        </Card>
      </div>
      {(stats.approved > 0 || stats.rejected > 0) && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleResetAll}>
            <RotateCcw className="h-3 w-3 mr-1" />Alle beslissingen resetten
          </Button>
        </div>
      )}

      {/* Results table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                Kwaliteitsaudit
              </CardTitle>
              <CardDescription>
                {filtered.length} restaurants met {filterLevel === 'all' ? 'flags' : filterLevel === 'clean' ? 'geen problemen' : filterLevel} gevonden
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterLevel} onValueChange={(v) => setFilterLevel(v as FilterLevel)}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle met flags</SelectItem>
                  <SelectItem value="critical">🔴 Hoog risico</SelectItem>
                  <SelectItem value="warning">🟡 Waarschuwing</SelectItem>
                  <SelectItem value="clean">🟢 Schoon</SelectItem>
                  <SelectItem value="approved">✅ Goedgekeurd</SelectItem>
                  <SelectItem value="rejected">❌ Geweigerd</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={runAudit}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Opnieuw scannen
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Risico</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Stad</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead className="w-24">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 100).map(r => (
                  <TableRow key={r.id} className={!r.is_active ? 'opacity-50' : ''}>
                    <TableCell>
                      {getRiskBadge(r.risk_score)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{r.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{r.address}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{r.city_name}</TableCell>
                    <TableCell>
                      <Badge variant={r.is_active ? 'default' : 'secondary'} className="text-xs">
                        {r.is_active ? 'Actief' : 'Inactief'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[300px]">
                        {r.flags.map((flag, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-muted"
                            title={flag.detail}
                          >
                            {getFlagIcon(flag.type)}
                            {flag.label}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {(filterLevel === 'approved' || filterLevel === 'rejected') ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleUndoDecision(r.id)}
                            title="Ongedaan maken — terug naar audit"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                              onClick={() => handleApprove(r.id)}
                              title="Goedkeuren"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleReject(r.id)}
                              title="Weigeren — markeer als verdacht"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => window.open(`/restaurant/${r.slug}`, '_blank')}
                          title="Bekijk restaurant"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {r.is_active && filterLevel !== 'approved' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDeactivate(r.id)}
                            disabled={deactivating === r.id}
                            title="Deactiveer restaurant"
                          >
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Geen restaurants gevonden voor dit filter
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 100 && (
            <div className="p-3 text-center text-xs text-muted-foreground border-t">
              Top 100 getoond van {filtered.length} resultaten
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
