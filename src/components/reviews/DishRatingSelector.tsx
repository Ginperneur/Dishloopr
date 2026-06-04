import { useState } from 'react';
import { Star, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDishName } from '@/lib/utils';

interface DishRating {
  dishId: string;
  dishName: string;
  rating: number;
}

interface DishRatingSelectorProps {
  availableDishes: { id: string; name: string }[];
  selectedRatings: DishRating[];
  onChange: (ratings: DishRating[]) => void;
}

export function DishRatingSelector({ availableDishes, selectedRatings, onChange }: DishRatingSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const setDishRating = (dishId: string, dishName: string, rating: number) => {
    const existing = selectedRatings.find(r => r.dishId === dishId);
    
    if (rating === 0) {
      // Remove rating
      onChange(selectedRatings.filter(r => r.dishId !== dishId));
    } else if (existing) {
      // Update rating
      onChange(selectedRatings.map(r => 
        r.dishId === dishId ? { ...r, rating } : r
      ));
    } else {
      // Add rating
      onChange([...selectedRatings, { dishId, dishName, rating }]);
    }
  };

  const getDishRating = (dishId: string) => {
    return selectedRatings.find(r => r.dishId === dishId)?.rating || 0;
  };

  if (availableDishes.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">Welke gerechten heb je gegeten?</span>
          {selectedRatings.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedRatings.length} beoordeeld
            </Badge>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-3 border-t">
              <p className="text-xs text-muted-foreground">
                Beoordeel de gerechten die je hebt geprobeerd. Dit helpt andere gebruikers!
              </p>
              
              <div className="space-y-2">
                {availableDishes.map(dish => {
                  const currentRating = getDishRating(dish.id);
                  
                  return (
                    <div key={dish.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm font-medium">{formatDishName(dish.name)}</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setDishRating(
                              dish.id, 
                              dish.name, 
                              star === currentRating ? 0 : star
                            )}
                            className="p-0.5 transition-transform hover:scale-110"
                            aria-label={`${star} ${star === 1 ? 'ster' : 'sterren'} voor ${dish.name}`}
                            aria-pressed={star <= currentRating}
                          >
                            <Star
                              className={`h-4 w-4 transition-colors ${
                                star <= currentRating
                                  ? 'fill-rating text-rating'
                                  : 'text-muted-foreground/40'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedRatings.length > 0 && (
                <div className="pt-2 text-xs text-green-600 dark:text-green-400">
                  ✓ Gerechten beoordeeld: {selectedRatings.map(r => r.dishName).join(', ')}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
