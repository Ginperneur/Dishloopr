import { useMemo } from 'react';
import { Star, TrendingUp, Globe, Phone, Calendar, LineChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OwnerEmptyState } from '@/components/owner/OwnerEmptyState';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { OwnerAnalytics } from '@/hooks/useOwnerDashboard';

interface AnalyticsTabProps {
  analytics: OwnerAnalytics | null;
  restaurant: any;
  reviews: any[];
}

export function AnalyticsTab({ analytics, restaurant, reviews }: AnalyticsTabProps) {
  const chartData = useMemo(() => {
    if (!analytics?.viewsByDay) return [];
    return analytics.viewsByDay.map(d => ({
      date: new Date(d.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
      views: d.count,
    }));
  }, [analytics?.viewsByDay]);

  const clickBreakdown = useMemo(() => [
    { name: 'Website', clicks: analytics?.websiteClicks || 0, fill: 'hsl(var(--primary))' },
    { name: 'Route', clicks: analytics?.routeClicks || 0, fill: 'hsl(var(--primary))' },
    { name: 'Telefoon', clicks: analytics?.phoneClicks || 0, fill: 'hsl(var(--primary) / 0.7)' },
    { name: 'Reservering', clicks: analytics?.reservationClicks || 0, fill: 'hsl(var(--primary) / 0.4)' },
  ], [analytics]);

  const totalClicks = analytics?.totalClicks || 0;
  const totalViews = analytics?.totalViews || 0;
  const conversionRate = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <h3 className="font-semibold">Laatste 30 dagen</h3>
      <div className="grid grid-cols-2 gap-4">
        <div><p className="text-sm text-muted-foreground">Vertoningen in resultaten</p><p className="text-2xl font-bold">{analytics?.impressions ?? '—'}</p></div>
        <div><p className="text-sm text-muted-foreground">Paginabezoeken</p><p className="text-2xl font-bold">{analytics?.totalViews ?? '—'}</p></div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {/* Click Breakdown Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">CTA Clicks Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={clickBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} className="fill-muted-foreground" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 13 }} className="fill-muted-foreground" width={90} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="clicks" radius={[0, 6, 6, 0]} name="Clicks" />
              </BarChart>
            </ResponsiveContainer>

            {/* Conversion rate */}
            <div className="mt-4 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Conversie ratio</span>
                <span className="text-lg font-bold">{conversionRate}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {totalClicks} clicks van {totalViews} weergaven
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Review Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review Statistieken</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Totaal reviews</span>
              <span className="font-semibold text-lg">{restaurant?.review_count || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Gemiddelde rating</span>
              <span className="font-semibold flex items-center gap-1 text-lg">
                <Star className="h-4 w-4 fill-rating text-rating" />
                {Number(restaurant?.rating || 0).toFixed(1)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Beantwoord</span>
              <span className="font-semibold text-lg">
                {reviews.filter(r => r.owner_response).length} / {reviews.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Reservering clicks</span>
              <span className="font-semibold text-lg">{analytics?.reservationClicks || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
