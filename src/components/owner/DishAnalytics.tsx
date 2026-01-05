import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Search,
  MousePointer,
  Utensils,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useDishAnalytics, DishAnalyticsData, DishInsight } from '@/hooks/useDishAnalytics';

interface DishAnalyticsProps {
  restaurantId: string;
  restaurantName: string;
}

function InsightCard({ insight }: { insight: DishInsight }) {
  const icons = {
    strength: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    opportunity: <Lightbulb className="h-5 w-5 text-amber-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-red-500" />
  };

  const colors = {
    strength: 'border-green-500/20 bg-green-500/5',
    opportunity: 'border-amber-500/20 bg-amber-500/5',
    warning: 'border-red-500/20 bg-red-500/5'
  };

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${colors[insight.type]}`}>
      {icons[insight.type]}
      <p className="text-sm">{insight.message}</p>
    </div>
  );
}

function DishRow({ dish, expanded, onToggle }: { 
  dish: DishAnalyticsData; 
  expanded: boolean;
  onToggle: () => void;
}) {
  const trendIcon = {
    up: <TrendingUp className="h-4 w-4 text-green-500" />,
    down: <TrendingDown className="h-4 w-4 text-red-500" />,
    stable: <Minus className="h-4 w-4 text-muted-foreground" />
  };

  const trendColor = {
    up: 'text-green-500',
    down: 'text-red-500',
    stable: 'text-muted-foreground'
  };

  // Calculate max clicks for chart scaling
  const maxClicks = Math.max(...dish.clicksByPeriod.map(d => d.clicks), 1);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Utensils className="h-5 w-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-semibold">{dish.dishName}</p>
            <p className="text-sm text-muted-foreground">
              {dish.searchVolume} zoekopdrachten totaal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-2xl font-bold">{dish.totalClicks}</p>
            <p className="text-xs text-muted-foreground">clicks</p>
          </div>
          <div className="flex items-center gap-1">
            {trendIcon[dish.trend]}
            <span className={`text-sm font-medium ${trendColor[dish.trend]}`}>
              {dish.trendPercentage > 0 ? '+' : ''}{dish.trendPercentage}%
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t bg-muted/30 p-4"
        >
          <div className="grid md:grid-cols-3 gap-6">
            {/* Mini chart */}
            <div className="md:col-span-2">
              <p className="text-sm font-medium mb-2">Clicks over tijd</p>
              <div className="h-24 flex items-end gap-[2px]">
                {dish.clicksByPeriod.slice(-30).map((day, i) => {
                  const height = maxClicks > 0 ? (day.clicks / maxClicks) * 100 : 0;
                  return (
                    <div
                      key={day.date}
                      className="flex-1 bg-primary/60 hover:bg-primary rounded-t transition-colors"
                      style={{ height: `${Math.max(height, 4)}%` }}
                      title={`${day.date}: ${day.clicks} clicks`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{dish.clicksByPeriod[0]?.date}</span>
                <span>{dish.clicksByPeriod[dish.clicksByPeriod.length - 1]?.date}</span>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Conversie</p>
                <div className="flex items-center gap-2">
                  <Progress value={dish.conversionRate} className="flex-1" />
                  <span className="text-sm font-medium">{dish.conversionRate.toFixed(1)}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Zoekvolume</p>
                <p className="text-lg font-semibold">{dish.searchVolume}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Trend</p>
                <div className="flex items-center gap-1">
                  {trendIcon[dish.trend]}
                  <span className={`font-medium ${trendColor[dish.trend]}`}>
                    {dish.trend === 'up' ? 'Stijgend' : dish.trend === 'down' ? 'Dalend' : 'Stabiel'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export function DishAnalytics({ restaurantId, restaurantName }: DishAnalyticsProps) {
  const { dishAnalytics, insights, loading, period, setPeriod } = useDishAnalytics(restaurantId);
  const [expandedDish, setExpandedDish] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const totalClicks = dishAnalytics.reduce((sum, d) => sum + d.totalClicks, 0);
  const topDish = dishAnalytics[0];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MousePointer className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Totale clicks op gerechten</p>
                <p className="text-3xl font-bold">{totalClicks}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Utensils className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Top gerecht</p>
                <p className="text-xl font-bold truncate">
                  {topDish?.dishName || 'Geen data'}
                </p>
                {topDish && (
                  <p className="text-sm text-muted-foreground">{topDish.totalClicks} clicks</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Actieve gerechten</p>
                <p className="text-3xl font-bold">{dishAnalytics.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Inzichten voor je restaurant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((insight, i) => (
              <InsightCard key={i} insight={insight} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Period Toggle & Dish List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Clicks per gerecht
            </CardTitle>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d' | '90d')}>
              <TabsList>
                <TabsTrigger value="7d">7 dagen</TabsTrigger>
                <TabsTrigger value="30d">30 dagen</TabsTrigger>
                <TabsTrigger value="90d">90 dagen</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {dishAnalytics.length > 0 ? (
            dishAnalytics.map(dish => (
              <DishRow
                key={dish.dishId}
                dish={dish}
                expanded={expandedDish === dish.dishId}
                onToggle={() => setExpandedDish(
                  expandedDish === dish.dishId ? null : dish.dishId
                )}
              />
            ))
          ) : (
            <div className="text-center py-12">
              <Utensils className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nog geen gerecht analytics beschikbaar
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Voeg gerechten toe aan je menu om te zien waar klanten je op vinden
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* What people search for vs what they find you on */}
      {dishAnalytics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Waar word je op gevonden?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dishAnalytics.slice(0, 5).map((dish, index) => {
                const percentage = totalClicks > 0 
                  ? (dish.totalClicks / totalClicks) * 100 
                  : 0;
                
                return (
                  <div key={dish.dishId}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{dish.dishName}</span>
                      <span className="text-sm text-muted-foreground">
                        {percentage.toFixed(0)}% van clicks
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={percentage} className="flex-1" />
                      <Badge variant={index === 0 ? 'default' : 'secondary'}>
                        {dish.totalClicks}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>

            {dishAnalytics.length > 5 && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                En {dishAnalytics.length - 5} andere gerechten...
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
