import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, ArrowRight, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    pct >= 80 ? 'Bijna perfect'
    : pct >= 50 ? 'Goed onderweg'
    : 'Net begonnen';

  const next = missing[0];
  const upcoming = missing.slice(1, 4);

  // Ring geometry
  const size = 88;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
      <Card className="overflow-hidden">
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-5">
            {/* Progress ring */}
            <div className="flex items-center gap-4 md:gap-5 shrink-0">
              <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                  <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke="hsl(var(--muted))"
                    strokeWidth={stroke}
                    fill="none"
                  />
                  <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke="hsl(var(--primary))"
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={c}
                    initial={{ strokeDashoffset: c }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 0.9, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold tabular-nums leading-none">{pct}%</span>
                  <span className="text-[10px] text-muted-foreground">{done}/{total}</span>
                </div>
              </div>
              <div className="md:hidden">
                <p className="font-semibold text-sm flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Profiel volledigheid
                </p>
                <p className="text-xs text-muted-foreground">{tone}</p>
              </div>
            </div>

            {/* Next step + upcoming */}
            <div className="flex-1 min-w-0 space-y-3">
              <div className="hidden md:flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="font-semibold text-sm">Profiel volledigheid</p>
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{tone}</Badge>
              </div>

              {next && (
                <button
                  onClick={() => onNavigateTab(next.tab)}
                  className="w-full flex items-center justify-between gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 hover:border-primary/40 transition-colors text-left group"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/80 mb-0.5">Volgende stap</p>
                    <p className="text-sm font-medium truncate">{next.label}</p>
                  </div>
                  <Button size="sm" variant="default" className="shrink-0 h-8 group-hover:translate-x-0.5 transition-transform">
                    Doen <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </button>
              )}

              {upcoming.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {upcoming.map(item => (
                    <button
                      key={item.id}
                      onClick={() => onNavigateTab(item.tab)}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                      <Circle className="h-3 w-3" />
                      {item.label}
                    </button>
                  ))}
                  {missing.length > 4 && (
                    <span className="inline-flex items-center px-2 py-1 text-xs text-muted-foreground">
                      +{missing.length - 4} meer
                    </span>
                  )}
                </div>
              )}

              {done > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/60">
                  {checks.filter(c => c.done).slice(0, 5).map(item => (
                    <span key={item.id} className="inline-flex items-center gap-1 text-[10px] text-primary/80">
                      <CheckCircle2 className="h-2.5 w-2.5" /> {item.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}