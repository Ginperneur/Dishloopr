import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Shield, Store, Calendar, TrendingUp } from 'lucide-react';

type Period = '7d' | '30d' | '90d' | '365d' | 'all';

interface ClaimRow {
  id: string;
  status: string;
  created_at: string;
  restaurant_id: string;
  restaurant_name?: string;
}

interface RestaurantSourceRow {
  id: string;
  name: string;
  added_by_source: string;
  claim_status: string;
  created_at: string;
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: 'Afgelopen 7 dagen' },
  { value: '30d', label: 'Afgelopen 30 dagen' },
  { value: '90d', label: 'Afgelopen 90 dagen' },
  { value: '365d', label: 'Afgelopen jaar' },
  { value: 'all', label: 'Alle tijd' },
];

const STATUS_LABELS: Record<string, string> = {
  pending: 'In afwachting',
  email_verified: 'E-mail geverifieerd',
  phone_verified: 'Telefoon geverifieerd',
  verified: 'Geverifieerd',
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
  superseded: 'Vervangen',
  pending_admin_review: 'Admin review',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500',
  email_verified: 'bg-blue-500',
  phone_verified: 'bg-indigo-500',
  verified: 'bg-emerald-500',
  approved: 'bg-emerald-600',
  rejected: 'bg-destructive',
  superseded: 'bg-muted-foreground',
  pending_admin_review: 'bg-orange-500',
};

const SOURCE_LABELS: Record<string, string> = {
  system: 'Systeem',
  admin: 'Admin',
  owner: 'Eigenaar',
};

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent-foreground))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function ClaimAnalytics() {
  const [period, setPeriod] = useState<Period>('30d');
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [sources, setSources] = useState<RestaurantSourceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const getDateFrom = (p: Period): string | null => {
    if (p === 'all') return null;
    const days = parseInt(p);
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    const dateFrom = getDateFrom(period);

    // Fetch claims
    let claimsQuery = supabase
      .from('restaurant_claims')
      .select('id, status, created_at, restaurant_id')
      .order('created_at', { ascending: false });

    if (dateFrom) {
      claimsQuery = claimsQuery.gte('created_at', dateFrom);
    }

    // Fetch restaurants with source info
    let sourcesQuery = supabase
      .from('restaurants')
      .select('id, name, added_by_source, claim_status, created_at')
      .order('created_at', { ascending: false });

    if (dateFrom) {
      sourcesQuery = sourcesQuery.gte('created_at', dateFrom);
    }

    const [claimsRes, sourcesRes] = await Promise.all([claimsQuery, sourcesQuery]);

    // Get restaurant names for claims
    const restaurantIds = [...new Set((claimsRes.data || []).map(c => c.restaurant_id))];
    let restaurantNames: Record<string, string> = {};
    if (restaurantIds.length > 0) {
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('id, name')
        .in('id', restaurantIds);
      restaurantNames = Object.fromEntries((restaurants || []).map(r => [r.id, r.name]));
    }

    setClaims((claimsRes.data || []).map(c => ({
      ...c,
      restaurant_name: restaurantNames[c.restaurant_id] || 'Onbekend',
    })));
    setSources(sourcesRes.data || []);
    setLoading(false);
  };

  // Claim status distribution
  const claimStatusData = useMemo(() => {
    const counts: Record<string, number> = {};
    claims.forEach(c => {
      counts[c.status] = (counts[c.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      status,
    }));
  }, [claims]);

  // Restaurant source distribution
  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    sources.forEach(s => {
      const src = s.added_by_source || 'system';
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts).map(([source, count]) => ({
      name: SOURCE_LABELS[source] || source,
      value: count,
    }));
  }, [sources]);

  // Claimed vs unclaimed
  const claimOverview = useMemo(() => {
    const claimed = sources.filter(s => s.claim_status !== 'unclaimed').length;
    const unclaimed = sources.filter(s => s.claim_status === 'unclaimed').length;
    return [
      { name: 'Geclaimd', value: claimed },
      { name: 'Niet geclaimd', value: unclaimed },
    ];
  }, [sources]);

  // Claims over time (grouped by week)
  const claimsTrend = useMemo(() => {
    const weekMap: Record<string, number> = {};
    claims.forEach(c => {
      const d = new Date(c.created_at);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
      weekMap[key] = (weekMap[key] || 0) + 1;
    });
    return Object.entries(weekMap)
      .slice(-12)
      .map(([week, count]) => ({ week, claims: count }));
  }, [claims]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted rounded-lg animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Claim & Bron Analyse
        </h3>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Totaal claims</p>
            <p className="text-2xl font-bold">{claims.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Goedgekeurd/Geverifieerd</p>
            <p className="text-2xl font-bold text-emerald-600">
              {claims.filter(c => ['approved', 'verified'].includes(c.status)).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Restaurants door eigenaar</p>
            <p className="text-2xl font-bold text-primary">
              {sources.filter(s => s.added_by_source === 'owner').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Restaurants door systeem</p>
            <p className="text-2xl font-bold">
              {sources.filter(s => s.added_by_source === 'system' || s.added_by_source === 'admin').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Claims trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Claims over tijd
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={claimsTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="claims" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Claims" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Source pie chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Store className="h-4 w-4" />
              Bron van restaurants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Claim status breakdown pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Claim status verdeling</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={claimStatusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {claimStatusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Geclaimd vs Niet geclaimd</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={claimOverview}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--muted-foreground))" />
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent claims table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Recente claims</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Datum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.slice(0, 15).map(claim => (
                <TableRow key={claim.id}>
                  <TableCell className="font-medium text-sm">{claim.restaurant_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      <span className={`w-2 h-2 rounded-full mr-1.5 inline-block ${STATUS_COLORS[claim.status] || 'bg-muted-foreground'}`} />
                      {STATUS_LABELS[claim.status] || claim.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(claim.created_at).toLocaleDateString('nl-NL')}
                  </TableCell>
                </TableRow>
              ))}
              {claims.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground text-sm py-8">
                    Geen claims in deze periode
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Restaurant source table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Restaurants per bron (recent)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Restaurant</TableHead>
                <TableHead>Toegevoegd door</TableHead>
                <TableHead>Claim status</TableHead>
                <TableHead>Datum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.slice(0, 15).map(restaurant => (
                <TableRow key={restaurant.id}>
                  <TableCell className="font-medium text-sm">{restaurant.name}</TableCell>
                  <TableCell>
                    <Badge variant={restaurant.added_by_source === 'owner' ? 'default' : 'secondary'} className="text-xs">
                      {SOURCE_LABELS[restaurant.added_by_source] || restaurant.added_by_source}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {restaurant.claim_status === 'unclaimed' ? 'Niet geclaimd' :
                       restaurant.claim_status === 'verified_owner' ? 'Geverifieerd' :
                       restaurant.claim_status === 'claimed_unverified' ? 'Ongeverifieerd' :
                       restaurant.claim_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(restaurant.created_at).toLocaleDateString('nl-NL')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
