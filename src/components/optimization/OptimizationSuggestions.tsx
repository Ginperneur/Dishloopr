import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, 
  Plus, 
  Euro, 
  Tag,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Suggestion {
  id: string;
  type: 'missing_dish' | 'price_mismatch' | 'underperforming_tag' | 'menu_gap';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  expectedImpact: string;
  actionLabel: string;
}

interface OptimizationSuggestionsProps {
  suggestions: Suggestion[];
  isPremium: boolean;
  onDismiss?: (id: string) => void;
}

export function OptimizationSuggestions({ 
  suggestions, 
  isPremium,
  onDismiss 
}: OptimizationSuggestionsProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleSuggestions = suggestions.filter(s => !dismissed.has(s.id));
  const displaySuggestions = isPremium ? visibleSuggestions : visibleSuggestions.slice(0, 2);

  const getTypeIcon = (type: Suggestion['type']) => {
    switch (type) {
      case 'missing_dish':
        return <Plus className="h-5 w-5" />;
      case 'price_mismatch':
        return <Euro className="h-5 w-5" />;
      case 'underperforming_tag':
        return <Tag className="h-5 w-5" />;
      default:
        return <Lightbulb className="h-5 w-5" />;
    }
  };

  const getPriorityStyles = (priority: Suggestion['priority']) => {
    switch (priority) {
      case 'high':
        return {
          bg: 'bg-red-50 dark:bg-red-950/20',
          border: 'border-red-200 dark:border-red-900',
          icon: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400',
          badge: 'bg-red-600'
        };
      case 'medium':
        return {
          bg: 'bg-amber-50 dark:bg-amber-950/20',
          border: 'border-amber-200 dark:border-amber-900',
          icon: 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400',
          badge: 'bg-amber-600'
        };
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-950/20',
          border: 'border-blue-200 dark:border-blue-900',
          icon: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400',
          badge: 'bg-blue-600'
        };
    }
  };

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
    onDismiss?.(id);
  };

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Alles ziet er goed uit!</h3>
          <p className="text-muted-foreground">
            Geen optimalisatiesuggesties op dit moment. Blijf je prestaties volgen.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          Optimalisatiesuggesties
          {visibleSuggestions.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {visibleSuggestions.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-6">
          Acties om je zichtbaarheid en conversies te verbeteren, gebaseerd op echte platformdata.
        </p>

        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {displaySuggestions.map((suggestion, index) => {
              const styles = getPriorityStyles(suggestion.priority);
              
              return (
                <motion.div
                  key={suggestion.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-lg border ${styles.bg} ${styles.border}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${styles.icon}`}>
                      {getTypeIcon(suggestion.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{suggestion.title}</h4>
                        <Badge className={styles.badge} variant="default">
                          {suggestion.priority === 'high' ? 'Hoog' : 
                           suggestion.priority === 'medium' ? 'Medium' : 'Laag'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {suggestion.description}
                      </p>
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-green-600 font-medium">
                          {suggestion.expectedImpact}
                        </span>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDismiss(suggestion.id)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>

        {!isPremium && visibleSuggestions.length > 2 && (
          <div className="mt-4 p-4 rounded-lg border-2 border-dashed border-primary/30 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              +{visibleSuggestions.length - 2} meer suggesties beschikbaar
            </p>
            <Badge variant="outline" className="text-primary">
              Upgrade voor alle inzichten
            </Badge>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Alle suggesties zijn gebaseerd op echte platformdata en gedragspatronen. 
            Geen manipulatie van reviews, ratings of populariteit mogelijk.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
