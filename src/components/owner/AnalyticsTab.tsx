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
    { name: 'Telefoon', clicks: analytics?.phoneClicks || 0, fill: 'hsl(var(--primary) / 0.7)' },
    { name: 'Reservering', clicks: analytics?.reservationClicks || 0, fill: 'hsl(var(--primary) / 0.4)' },
  ], [analytics]);

  const totalClicks = analytics?.totalClicks || 0;
  const totalViews = analytics?.totalViews || 0;
  const conversionRate = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Views Area Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weergaven per dag (laatste 30 dagen)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="fill-muted-foreground"
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: 13,
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#viewsGradient)"
                  name="Weergaven"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <OwnerEmptyState
              icon={LineChart}
              title="Nog geen analytics-data"
              description="Zodra gasten je profiel bekijken zie je hier dagelijkse weergaven, klikken en trends."
            />
          )}
        </CardContent>
      </Card>

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
