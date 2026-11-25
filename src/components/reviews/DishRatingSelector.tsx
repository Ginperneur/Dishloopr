import { useMemo, useState } from 'react';
import { Star, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatDishName } from '@/lib/utils';

interface DishRating {
  dishId: string;
  dishName: string;
  rating: number;
}

interface DishRatingSelectorProps {
  availableDishes: { id: string; name: string; price?: number | null }[];
  selectedRatings: DishRating[];
  onChange: (ratings: DishRating[]) => void;
  /** Open from the start without a toggle (a review about a dish). */
  alwaysOpen?: boolean;
  label?: string;
}

const euro = (n: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);

export function DishRatingSelector({ availableDishes, selectedRatings, onChange, alwaysOpen = false, label = 'Welke gerechten heb je gegeten?' }: DishRatingSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const open = alwaysOpen || isExpanded;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? availableDishes.filter(d => d.name.toLowerCase().includes(q)) : availableDishes;
    // Rated dishes stay on top, so a guest sees what they picked while searching.
    const rated = new Set(selectedRatings.map(r => r.dishId));
    return [...list.filter(d => rated.has(d.id)), ...list.filter(d => !rated.has(d.id))];
  }, [availableDishes, query, selectedRatings]);

  const setDishRating = (dishId: string, dishName: string, rating: number) => {
    const existing = selectedRatings.find(r => r.dishId === dishId);
    if (rating === 0) onChange(selectedRatings.filter(r => r.dishId !== dishId));
    else if (existing) onChange(selectedRatings.map(r => (r.dishId === dishId ? { ...r, rating } : r)));
    else onChange([...selectedRatings, { dishId, dishName, rating }]);
  };

  const getDishRating = (dishId: string) => selectedRatings.find(r => r.dishId === dishId)?.rating || 0;

  if (availableDishes.length === 0) {
    return alwaysOpen
      ? <p className="text-sm text-muted-foreground">Dit restaurant heeft nog geen gerechten op Dishloopr staan. Schrijf een review over het restaurant.</p>
      : null;
  }

  const list = (
    <div className="space-y-3 p-3">
      {availableDishes.length > 8 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Zoek op de kaart" aria-label="Zoek een gerecht op de kaart" className="min-h-11 pl-9 text-base" />
        </div>
      )}
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {shown.map(dish => {
          const currentRating = getDishRating(dish.id);
          return (
            <div key={dish.id} className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 ${currentRating ? 'bg-primary/10' : ''}`}>
              <span className="min-w-0 text-sm">
                <span className="font-medium">{formatDishName(dish.name)}</span>
                {dish.price != null && <span className="ml-2 tabular-nums text-muted-foreground">{euro(dish.price)}</span>}
              </span>
              <div className="flex shrink-0 items-center">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setDishRating(dish.id, dish.name, star === currentRating ? 0 : star)}
                    className="flex h-9 w-9 items-center justify-center transition-transform hover:scale-110"
                    aria-label={`${star} ${star === 1 ? 'ster' : 'sterren'} voor ${dish.name}`}
                    aria-pressed={star <= currentRating}
                  >
                    <Star className={`h-5 w-5 transition-colors ${star <= currentRating ? 'fill-rating text-rating' : 'text-muted-foreground/40'}`} />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <p className="py-3 text-center text-sm text-muted-foreground">Geen gerecht gevonden.</p>}
      </div>
      {selectedRatings.length > 0 && (
        <p className="text-xs text-green-700 dark:text-green-400">
          Beoordeeld: {selectedRatings.map(r => formatDishName(r.dishName)).join(', ')}
        </p>
      )}
    </div>
  );

  if (alwaysOpen) {
    return (
      <div className="overflow-hidden rounded-lg border">
        <p className="border-b bg-muted/30 px-3 py-2.5 text-sm font-medium">{label}</p>
        {list}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between bg-muted/30 p-3 transition-colors hover:bg-muted/50"
      >
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {selectedRatings.length > 0 && <Badge variant="secondary" className="text-xs">{selectedRatings.length} beoordeeld</Badge>}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {list}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
