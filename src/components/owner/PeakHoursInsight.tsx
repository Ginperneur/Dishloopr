import { useMemo } from 'react';
import { Clock, Eye, MousePointer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import type { PeakHourData, PeakDayData } from '@/hooks/useMarketInsights';

interface PeakHoursInsightProps {
  peakHours: PeakHourData[];
  peakDays: PeakDayData[];
}

export function PeakHoursInsight({ peakHours, peakDays }: PeakHoursInsightProps) {
  const totalEvents = peakHours.reduce((s, h) => s + h.views + h.clicks, 0);

  const topHours = useMemo(() => {
    return [...peakHours]
      .sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks))
      .slice(0, 3);
  }, [peakHours]);

  const topDay = useMemo(() => {
    return [...peakDays].sort((a, b) => (b.views + b.clicks) - (a.views + a.clicks))[0];
  }, [peakDays]);

  const hourChartData = peakHours.map(h => ({
    name: `${h.hour}:00`,
    Weergaven: h.views,
    Clicks: h.clicks,
  }));

  const dayChartData = peakDays
    .sort((a, b) => {
      // Start week on Monday
      const order = [1, 2, 3, 4, 5, 6, 0];
      return order.indexOf(a.day) - order.indexOf(b.day);
    })
    .map(d => ({
      name: d.dayLabel,
      Weergaven: d.views,
      Clicks: d.clicks,
    }));

  if (totalEvents === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Clock className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Nog niet genoeg data om piekuren te tonen.</p>
          <p className="text-xs text-muted-foreground mt-1">Data wordt verzameld over de laatste 30 dagen.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Drukste uur</p>
            <span className="text-2xl font-bold">{topHours[0]?.hour || 0}:00</span>
            <p className="text-xs text-muted-foreground mt-1">
              {topHours[0]?.views || 0} weergaven
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Drukste dag</p>
            <span className="text-2xl font-bold">{topDay?.dayLabel || '-'}</span>
            <p className="text-xs text-muted-foreground mt-1">
              {topDay?.views || 0} weergaven
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Piek-uren</p>
            <div className="flex gap-1 justify-center flex-wrap">
              {topHours.map(h => (
                <Badge key={h.hour} variant="secondary">{h.hour}:00</Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Top 3 uren</p>
          </CardContent>
        </Card>
      </div>

      {/* Hourly Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Activiteit per uur (laatste 30 dagen)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={hourChartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={2} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Weergaven" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Clicks" fill="hsl(var(--primary) / 0.5)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Daily Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            Activiteit per dag
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dayChartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Weergaven" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Clicks" fill="hsl(var(--primary) / 0.5)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
