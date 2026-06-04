import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  Gauge, 
  Sparkles, 
  Lock,
  TrendingUp,
  ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DishVisibilityDiagnostics } from './DishVisibilityDiagnostics';
import { TagAnalysis } from './TagAnalysis';
import { OptimizationSuggestions } from './OptimizationSuggestions';
import { SimulationMode } from './SimulationMode';
import { useOptimizationInsights } from '@/hooks/useOptimizationInsights';
import { useOwnerProCheckout } from '@/hooks/useOwnerProCheckout';
import { Loader2 } from 'lucide-react';

interface OptimizationDashboardProps {
  restaurantId: string;
  restaurantName: string;
}

export function OptimizationDashboard({ restaurantId, restaurantName }: OptimizationDashboardProps) {
  const { t } = useTranslation();
  const { data, loading, error, simulateChange } = useOptimizationInsights(restaurantId);
  const [activeTab, setActiveTab] = useState('overview');
  const { startCheckout, loading: checkoutLoading } = useOwnerProCheckout();

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-32 bg-muted rounded-lg mb-4" />
          <div className="grid md:grid-cols-2 gap-4">
            <div className="h-64 bg-muted rounded-lg" />
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Opnieuw proberen
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Gauge className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Geen optimalisatiedata beschikbaar</p>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return 'Goed';
    if (score >= 40) return 'Matig';
    return 'Verbetering nodig';
  };

  return (
    <div className="space-y-6">
      {/* Score overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className={`text-5xl font-bold ${getScoreColor(data.overallScore)}`}>
                    {data.overallScore}
                  </div>
                  <div className="text-sm text-muted-foreground">/100</div>
                </div>
                <div>
                  <h2 className="text-xl font-semibold mb-1">Optimalisatiescore</h2>
                  <p className="text-muted-foreground">
                    {getScoreLabel(data.overallScore)} - {data.suggestions.length} verbeterpunten gevonden
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Gerechten getrackt</p>
                  <p className="text-2xl font-bold">{data.dishVisibility.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Tags geanalyseerd</p>
                  <p className="text-2xl font-bold">{data.tagAnalysis.length}</p>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            {data.suggestions.filter(s => s.priority === 'high').length > 0 && (
              <div className="mt-6 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-5 w-5 text-red-600" />
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-200">
                        {data.suggestions.filter(s => s.priority === 'high').length} hoge-prioriteit suggesties
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        Deze kunnen je zichtbaarheid aanzienlijk verbeteren
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setActiveTab('suggestions')}
                    className="border-red-200 text-red-700 hover:bg-red-100"
                  >
                    Bekijk suggesties
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Upgrade banner for non-premium */}
      {!data.isPremium && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Upgrade naar Premium Inzichten</h3>
                    <p className="text-sm text-muted-foreground">
                      Onbeperkte simulaties, volledige concurrentieanalyse en prioriteitssupport
                    </p>
                  </div>
                </div>
                <Button onClick={() => startCheckout('monthly')} disabled={checkoutLoading !== null}>
                  {checkoutLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  €29/maand
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tabs for different insights */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="dishes">Gerechten</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="suggestions">Suggesties</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Quick dish visibility */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Top Gerechten</CardTitle>
              </CardHeader>
              <CardContent>
                {data.dishVisibility.slice(0, 3).map(dish => (
                  <div key={dish.dishId} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{dish.dishName}</p>
                      <p className="text-xs text-muted-foreground">
                        #{dish.position} van {dish.totalRestaurants}
                      </p>
                    </div>
                    <Badge variant={dish.position <= 3 ? 'default' : 'secondary'}>
                      {dish.clickShare}% clicks
                    </Badge>
                  </div>
                ))}
                {data.dishVisibility.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nog geen gerechten getrackt
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Simulation mode */}
            <SimulationMode 
              restaurantId={restaurantId}
              isPremium={data.isPremium}
              onSimulate={simulateChange}
            />
          </div>

          {/* Quick suggestions */}
          <OptimizationSuggestions 
            suggestions={data.suggestions.slice(0, 3)} 
            isPremium={data.isPremium}
          />
        </TabsContent>

        <TabsContent value="dishes">
          <DishVisibilityDiagnostics 
            dishes={data.dishVisibility}
            isPremium={data.isPremium}
          />
        </TabsContent>

        <TabsContent value="tags">
          <TagAnalysis tags={data.tagAnalysis} />
        </TabsContent>

        <TabsContent value="suggestions">
          <OptimizationSuggestions 
            suggestions={data.suggestions}
            isPremium={data.isPremium}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
