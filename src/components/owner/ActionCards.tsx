import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Plus, 
  TrendingUp, 
  AlertTriangle,
  ArrowRight,
  Utensils,
  Gauge
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ActionItem {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  action: () => void;
  actionLabel: string;
  priority: 'high' | 'medium' | 'low';
}

interface ActionCardsProps {
  unansweredReviews: number;
  suggestedDishes: number;
  optimizationScore: number | null;
  trendingMissingDishes: number;
  onNavigateTab: (tab: string) => void;
}

export function ActionCards({
  unansweredReviews,
  suggestedDishes,
  optimizationScore,
  trendingMissingDishes,
  onNavigateTab
}: ActionCardsProps) {
  const actions: ActionItem[] = [];

  if (unansweredReviews > 0) {
    actions.push({
      id: 'reviews',
      icon: <MessageSquare className="h-5 w-5" />,
      title: `${unansweredReviews} onbeantwoorde review${unansweredReviews > 1 ? 's' : ''}`,
      description: 'Reageer op reviews om je betrokkenheid te tonen',
      badge: 'Actie vereist',
      badgeVariant: 'destructive',
      action: () => onNavigateTab('reviews'),
      actionLabel: 'Bekijk reviews',
      priority: 'high'
    });
  }

  if (suggestedDishes > 0) {
    actions.push({
      id: 'dishes',
      icon: <Utensils className="h-5 w-5" />,
      title: `${suggestedDishes} gerechtsuggestie${suggestedDishes > 1 ? 's' : ''} wachten`,
      description: 'Bevestig gerechten zodat gasten je beter vinden',
      badge: 'Suggestie',
      badgeVariant: 'secondary',
      action: () => onNavigateTab('dish-confirmation'),
      actionLabel: 'Bevestig gerechten',
      priority: 'medium'
    });
  }

  if (trendingMissingDishes > 0) {
    actions.push({
      id: 'trending',
      icon: <TrendingUp className="h-5 w-5" />,
      title: `${trendingMissingDishes} trending gerecht${trendingMissingDishes > 1 ? 'en' : ''} ontbreken`,
      description: 'Populaire gerechten die je nog niet aanbiedt',
      badge: 'Kans',
      badgeVariant: 'outline',
      action: () => onNavigateTab('optimization'),
      actionLabel: 'Bekijk kansen',
      priority: 'medium'
    });
  }

  if (optimizationScore !== null && optimizationScore < 50) {
    actions.push({
      id: 'optimization',
      icon: <Gauge className="h-5 w-5" />,
      title: 'Je optimalisatiescore is laag',
      description: `Score: ${optimizationScore}/100 — er zijn verbeterpunten`,
      badge: 'Verbeteren',
      badgeVariant: 'outline',
      action: () => onNavigateTab('optimization'),
      actionLabel: 'Verbeter score',
      priority: 'low'
    });
  }

  if (actions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mb-8"
    >
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Acties voor vandaag
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {actions.slice(0, 4).map((action, index) => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + index * 0.05 }}
          >
            <Card className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={action.action}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 ${
                    action.priority === 'high' 
                      ? 'bg-destructive/10 text-destructive' 
                      : action.priority === 'medium'
                      ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {action.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-sm truncate">{action.title}</p>
                      {action.badge && (
                        <Badge variant={action.badgeVariant} className="text-[10px] px-1.5 py-0 shrink-0">
                          {action.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
