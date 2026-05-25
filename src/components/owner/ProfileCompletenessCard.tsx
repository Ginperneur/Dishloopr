import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Sparkles, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Restaurant {
  id: string;
  description?: string | null;
  images?: string[] | null;
  opening_hours?: any;
  phone?: string | null;
  website?: string | null;
  instagram_url?: string | null;
  [k: string]: any;
}

interface Props {
  restaurant: Restaurant | null;
  dishCount: number;
  onNavigateTab: (tab: string) => void;
}

export function ProfileCompletenessCard({ restaurant, dishCount, onNavigateTab }: Props) {
  const [menuItemCount, setMenuItemCount] = useState(0);

  useEffect(() => {
    if (!restaurant?.id) return;
    (async () => {
      const { count } = await supabase
        .from('menu_items')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id);
      setMenuItemCount(count || 0);
    })();
  }, [restaurant?.id]);

  const checks = useMemo(() => {
    if (!restaurant) return [];
    const hours = restaurant.opening_hours;
    const hasHours = !!hours && (Array.isArray(hours) ? hours.length > 0 : Object.keys(hours).length > 0);
    return [
      { id: 'desc', label: 'Beschrijving toegevoegd', done: !!restaurant.description && restaurant.description.length > 30, tab: 'content' },
      { id: 'photos', label: 'Minimaal 3 foto\'s', done: (restaurant.images?.length || 0) >= 3, tab: 'content' },
      { id: 'hours', label: 'Openingstijden ingesteld', done: hasHours, tab: 'content' },
      { id: 'phone', label: 'Telefoonnummer', done: !!restaurant.phone, tab: 'content' },
      { id: 'website', label: 'Website', done: !!restaurant.website, tab: 'content' },
      { id: 'menu', label: 'Minimaal 1 menu-item', done: menuItemCount >= 1, tab: 'content' },
      { id: 'dishes', label: 'Minimaal 3 gerechten', done: dishCount >= 3, tab: 'content' },
      { id: 'social', label: 'Sociale media gekoppeld', done: !!restaurant.instagram_url, tab: 'content' },
    ];
  }, [restaurant, menuItemCount, dishCount]);

  const done = checks.filter(c => c.done).length;
  const total = checks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const missing = checks.filter(c => !c.done);

  if (pct === 100 || total === 0) return null;

  const tone =
    pct >= 80 ? { label: 'Bijna perfect', color: 'text-primary' }
    : pct >= 50 ? { label: 'Goed onderweg', color: 'text-primary' }
    : { label: 'Net begonnen', color: 'text-accent-foreground' };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
      <Card className="overflow-hidden">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Profiel volledigheid</p>
                <p className={`text-xs font-medium ${tone.color}`}>{tone.label} — {done} van {total}</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-sm font-bold">{pct}%</Badge>
          </div>

          <Progress value={pct} className="h-2 mb-4" />

          {missing.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Nog te doen</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {missing.slice(0, 6).map(item => (
                  <button
                    key={item.id}
                    onClick={() => onNavigateTab(item.tab)}
                    className="flex items-center justify-between gap-2 p-2 rounded-md border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs truncate">{item.label}</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {done > 0 && missing.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {checks.filter(c => c.done).slice(0, 4).map(item => (
                <Badge key={item.id} variant="outline" className="text-[10px] gap-1 text-primary border-primary/30">
                  <CheckCircle2 className="h-2.5 w-2.5" /> {item.label}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}