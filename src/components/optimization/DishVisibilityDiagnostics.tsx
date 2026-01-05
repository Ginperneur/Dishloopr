import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Users,
  BarChart3,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface DishVisibility {
  dishId: string;
  dishName: string;
  position: number;
  totalRestaurants: number;
  topCompetitors: { name: string; rating: number; position: number }[];
  searchVolume: number;
  clickShare: number;
}

interface DishVisibilityDiagnosticsProps {
  dishes: DishVisibility[];
  isPremium: boolean;
}

export function DishVisibilityDiagnostics({ dishes, isPremium }: DishVisibilityDiagnosticsProps) {
  const { t } = useTranslation();
  
  // Show limited data for non-premium
  const visibleDishes = isPremium ? dishes : dishes.slice(0, 3);

  if (dishes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nog geen gerechten gekoppeld aan je restaurant
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Gerecht Zichtbaarheid
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-6">
            Ontdek waar je restaurant verschijnt per gerecht en hoe je scoort ten opzichte van concurrenten.
          </p>

          <Accordion type="single" collapsible className="space-y-2">
            {visibleDishes.map((dish, index) => (
              <AccordionItem 
                key={dish.dishId} 
                value={dish.dishId}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className={`
                        h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold
                        ${dish.position === 1 ? 'bg-yellow-100 text-yellow-700' : 
                          dish.position <= 3 ? 'bg-green-100 text-green-700' : 
                          'bg-muted text-muted-foreground'}
                      `}>
                        #{dish.position}
                      </div>
                      <div className="text-left">
                        <p className="font-medium">{dish.dishName}</p>
                        <p className="text-xs text-muted-foreground">
                          {dish.searchVolume} zoekopdrachten/maand
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge variant={dish.clickShare > 30 ? 'default' : 'secondary'}>
                        {dish.clickShare}% clicks
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4">
                  <div className="grid md:grid-cols-2 gap-6 pt-2">
                    {/* Position analysis */}
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Concurrentie positie
                      </h4>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Je positie</span>
                          <span className="font-semibold">
                            #{dish.position} van {dish.totalRestaurants}
                          </span>
                        </div>
                        <Progress 
                          value={100 - ((dish.position - 1) / Math.max(dish.totalRestaurants - 1, 1)) * 100} 
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          {dish.position === 1 
                            ? '🏆 Je bent de top-keuze voor dit gerecht!' 
                            : dish.position <= 3 
                            ? '✨ Top 3 - Goede zichtbaarheid'
                            : `📈 ${dish.position - 1} restaurants scoren hoger`}
                        </p>
                      </div>
                    </div>

                    {/* Top competitors */}
                    <div>
                      <h4 className="text-sm font-medium mb-3">Top Concurrenten</h4>
                      {dish.topCompetitors.length > 0 ? (
                        <div className="space-y-2">
                          {dish.topCompetitors.map((comp) => (
                            <div 
                              key={comp.name}
                              className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50"
                            >
                              <span className="flex items-center gap-2">
                                <span className="text-muted-foreground">#{comp.position}</span>
                                {comp.name}
                              </span>
                              <span className="text-muted-foreground">
                                ⭐ {comp.rating.toFixed(1)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Geen concurrenten voor dit gerecht
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Performance tips */}
                  <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-sm">
                      {dish.position === 1 ? (
                        <span className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          Behoud je positie door reviews aan te moedigen
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-amber-600" />
                          Verbeter je rating om hoger te scoren (+{((dish.topCompetitors[0]?.rating || dish.position) - 0.5).toFixed(1)} nodig)
                        </span>
                      )}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {!isPremium && dishes.length > 3 && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 p-4 rounded-lg border-2 border-dashed border-primary/30 text-center"
            >
              <p className="text-sm text-muted-foreground mb-2">
                +{dishes.length - 3} meer gerechten beschikbaar met Premium
              </p>
              <Badge variant="outline" className="text-primary">
                Upgrade voor volledige inzichten
              </Badge>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
