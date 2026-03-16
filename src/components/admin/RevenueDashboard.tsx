import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Crown, Sparkles, FileText, TrendingUp, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface RevenueData {
  featuredTotal: number;
  featuredActive: number;
  featuredRevenue: number;
  sponsoredActive: number;
  sponsoredRevenue: number;
  newsletterRevenue: number;
  newsletterCount: number;
  totalMonthlyRevenue: number;
  revenueByMonth: { month: string; featured: number; sponsored: number; newsletter: number }[];
  topRestaurants: { name: string; totalSpend: number; type: string }[];
}

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#8b5cf6'];

export function RevenueDashboard() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRevenue();
  }, []);

  const fetchRevenue = async () => {
    setLoading(true);

    const [
      { data: featuredSubs },
      { data: sponsoredPurchases },
      { data: newsletterPlacements },
    ] = await Promise.all([
      supabase.from('featured_subscriptions').select('*, restaurants:restaurant_id(name)'),
      supabase.from('sponsored_purchases' as any).select('*, restaurants:restaurant_id(name)').catch(() => ({ data: [] })),
      supabase.from('newsletter_placements').select('*, restaurants:restaurant_id(name)').eq('status', 'paid'),
    ]);

    const subs = featuredSubs || [];
    const sponsored = (sponsoredPurchases as any[]) || [];
    const newsletters = newsletterPlacements || [];

    const activeSubs = subs.filter((s: any) => s.status === 'active');
    const featuredRevenue = activeSubs.reduce((sum: number, s: any) => sum + Number(s.total_monthly_price || 0), 0);
    const sponsoredRevenue = sponsored.reduce((sum: number, s: any) => sum + Number(s.price_paid || 0), 0);
    const nlRevenue = newsletters.reduce((sum: number, n: any) => sum + Number(n.price_paid || 0), 0);

    // Revenue by month (last 6 months)
    const months: { month: string; featured: number; sponsored: number; newsletter: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = `${d.getMonth() + 1}/${d.getFullYear().toString().slice(2)}`;
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);

      const fRev = subs
        .filter((s: any) => new Date(s.starts_at) < mEnd && new Date(s.expires_at) > mStart && s.status === 'active')
        .reduce((sum: number, s: any) => sum + Number(s.total_monthly_price || 0), 0);
      
      const nlRev = newsletters
        .filter((n: any) => { const c = new Date(n.created_at); return c >= mStart && c < mEnd; })
        .reduce((sum: number, n: any) => sum + Number(n.price_paid || 0), 0);

      months.push({ month: label, featured: fRev, sponsored: 0, newsletter: nlRev });
    }

    // Top spending restaurants
    const spendMap = new Map<string, { name: string; total: number; type: string }>();
    activeSubs.forEach((s: any) => {
      const name = (s.restaurants as any)?.name || 'Onbekend';
      const existing = spendMap.get(s.restaurant_id) || { name, total: 0, type: 'featured' };
      existing.total += Number(s.total_monthly_price || 0);
      spendMap.set(s.restaurant_id, existing);
    });
    newsletters.forEach((n: any) => {
      const name = (n.restaurants as any)?.name || 'Onbekend';
      const existing = spendMap.get(n.restaurant_id) || { name, total: 0, type: 'newsletter' };
      existing.total += Number(n.price_paid || 0);
      spendMap.set(n.restaurant_id, existing);
    });

    const topRestaurants = [...spendMap.values()].sort((a, b) => b.total - a.total).slice(0, 10);

    setData({
      featuredTotal: subs.length,
      featuredActive: activeSubs.length,
      featuredRevenue,
      sponsoredActive: sponsored.filter((s: any) => s.is_active).length,
      sponsoredRevenue,
      newsletterRevenue: nlRevenue,
      newsletterCount: newsletters.length,
      totalMonthlyRevenue: featuredRevenue + nlRevenue,
      revenueByMonth: months,
      topRestaurants,
    });
    setLoading(false);
  };

  if (loading || !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Revenue data laden...</p>
        </CardContent>
      </Card>
    );
  }

  const pieData = [
    { name: 'Featured Spots', value: data.featuredRevenue },
    { name: 'Nieuwsbrief', value: data.newsletterRevenue },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4">
      {/* Revenue Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-bold text-emerald-600">€{data.totalMonthlyRevenue.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">MRR (maandelijks)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <Crown className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="text-[10px]">{data.featuredActive} actief</Badge>
            </div>
            <p className="text-2xl font-bold">€{data.featuredRevenue.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Featured Spots</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Badge variant="outline" className="text-[10px]">{data.newsletterCount}x</Badge>
            </div>
            <p className="text-2xl font-bold">€{data.newsletterRevenue.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Nieuwsbrief</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{data.topRestaurants.length}</p>
            <p className="text-xs text-muted-foreground">Betalende klanten</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Revenue Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Omzet per maand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${v}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [`€${value.toFixed(2)}`, '']}
                  />
                  <Bar dataKey="featured" stackId="a" fill="hsl(var(--primary))" name="Featured" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="newsletter" stackId="a" fill="#10b981" name="Nieuwsbrief" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Spenders */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top betalende restaurants</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {data.topRestaurants.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm py-2">{r.name}</TableCell>
                    <TableCell className="text-right py-2">
                      <span className="font-mono text-sm font-medium text-emerald-600">€{r.total.toFixed(0)}</span>
                    </TableCell>
                  </TableRow>
                ))}
                {data.topRestaurants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-4">Nog geen betalende klanten</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
