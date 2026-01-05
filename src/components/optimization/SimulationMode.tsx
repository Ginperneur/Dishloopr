import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wand2, 
  TrendingUp, 
  TrendingDown,
  ArrowRight,
  Search,
  Sparkles,
  Lock,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface SimulationResult {
  currentPosition: number;
  projectedPosition: number;
  visibilityChange: number;
  competitorComparison: string;
  confidence: number;
}

interface SimulationModeProps {
  restaurantId: string;
  isPremium: boolean;
  onSimulate: (
    changeType: 'add_dish' | 'remove_tag' | 'change_price',
    params: { dishId?: string; tag?: string; newPriceLevel?: number }
  ) => Promise<SimulationResult | null>;
}

interface Dish {
  id: string;
  name: string;
  search_count: number;
}

export function SimulationMode({ restaurantId, isPremium, onSimulate }: SimulationModeProps) {
  const { t } = useTranslation();
  const [simulationType, setSimulationType] = useState<'add_dish' | 'remove_tag' | 'change_price'>('add_dish');
  const [availableDishes, setAvailableDishes] = useState<Dish[]>([]);
  const [selectedDishId, setSelectedDishId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [simulationsUsed, setSimulationsUsed] = useState(0);

  const maxFreeSimulations = 3;

  useEffect(() => {
    const fetchDishes = async () => {
      // Fetch dishes not yet associated with this restaurant
      const { data: restaurantDishes } = await supabase
        .from('restaurant_dishes')
        .select('dish_id')
        .eq('restaurant_id', restaurantId);

      const existingDishIds = (restaurantDishes || []).map(rd => rd.dish_id);

      const { data: dishes } = await supabase
        .from('dishes')
        .select('id, name, search_count')
        .eq('is_active', true)
        .order('search_count', { ascending: false })
        .limit(100);

      setAvailableDishes(
        (dishes || []).filter(d => !existingDishIds.includes(d.id))
      );
    };

    fetchDishes();
  }, [restaurantId]);

  const filteredDishes = availableDishes.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 10);

  const handleSimulate = async () => {
    if (!isPremium && simulationsUsed >= maxFreeSimulations) return;
    
    setLoading(true);
    try {
      const simResult = await onSimulate(simulationType, { dishId: selectedDishId });
      setResult(simResult);
      setSimulationsUsed(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  const canSimulate = isPremium || simulationsUsed < maxFreeSimulations;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          Simulatie Modus
          {!isPremium && (
            <Badge variant="secondary" className="ml-2">
              {maxFreeSimulations - simulationsUsed} gratis over
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-6">
          Voorspel hoe wijzigingen aan je profiel je zichtbaarheid zullen beïnvloeden.
        </p>

        {!canSimulate ? (
          <div className="text-center py-8">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Simulatie limiet bereikt</h3>
            <p className="text-muted-foreground mb-4">
              Upgrade naar Premium voor onbeperkte simulaties
            </p>
            <Button>
              <Sparkles className="h-4 w-4 mr-2" />
              Upgrade naar Premium
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Simulation type selector */}
            <div>
              <label className="text-sm font-medium mb-2 block">Wat wil je simuleren?</label>
              <Select 
                value={simulationType} 
                onValueChange={(v) => {
                  setSimulationType(v as any);
                  setResult(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add_dish">Gerecht toevoegen</SelectItem>
                  <SelectItem value="remove_tag" disabled={!isPremium}>
                    Tag verwijderen {!isPremium && '(Premium)'}
                  </SelectItem>
                  <SelectItem value="change_price" disabled={!isPremium}>
                    Prijsniveau wijzigen {!isPremium && '(Premium)'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Dish selector for add_dish simulation */}
            {simulationType === 'add_dish' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Welk gerecht?</label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Zoek gerecht..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-48 overflow-auto space-y-1 border rounded-lg p-2">
                  {filteredDishes.map(dish => (
                    <button
                      key={dish.id}
                      onClick={() => {
                        setSelectedDishId(dish.id);
                        setResult(null);
                      }}
                      className={`w-full text-left p-2 rounded-lg transition-colors flex items-center justify-between ${
                        selectedDishId === dish.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <span>{dish.name}</span>
                      <span className="text-xs opacity-70">
                        {dish.search_count} zoekopdrachten/maand
                      </span>
                    </button>
                  ))}
                  {filteredDishes.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Geen gerechten gevonden
                    </p>
                  )}
                </div>
              </div>
            )}

            <Button 
              onClick={handleSimulate}
              disabled={loading || (simulationType === 'add_dish' && !selectedDishId)}
              className="w-full"
            >
              {loading ? (
                'Simuleren...'
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Simuleer wijziging
                </>
              )}
            </Button>

            {/* Simulation result */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 rounded-lg bg-muted/50 border"
                >
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Simulatieresultaat
                  </h4>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 rounded-lg bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Verwachte positie</p>
                      <p className="text-2xl font-bold">#{result.projectedPosition}</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background">
                      <p className="text-xs text-muted-foreground mb-1">Zichtbaarheid</p>
                      <p className={`text-2xl font-bold flex items-center justify-center gap-1 ${
                        result.visibilityChange > 0 ? 'text-green-600' : 
                        result.visibilityChange < 0 ? 'text-red-600' : ''
                      }`}>
                        {result.visibilityChange > 0 ? (
                          <TrendingUp className="h-5 w-5" />
                        ) : result.visibilityChange < 0 ? (
                          <TrendingDown className="h-5 w-5" />
                        ) : null}
                        {result.visibilityChange > 0 ? '+' : ''}{result.visibilityChange}%
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-3">
                    {result.competitorComparison}
                  </p>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Betrouwbaarheid</span>
                      <span>{result.confidence}%</span>
                    </div>
                    <Progress value={result.confidence} className="h-1.5" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Info disclaimer */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Simulaties zijn schattingen gebaseerd op huidige marktdata en kunnen 
                afwijken van werkelijke resultaten.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
