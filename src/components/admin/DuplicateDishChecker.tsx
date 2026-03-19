import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Check, Trash2, Link } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ChainDuplicate {
  dishName: string;
  dishId: string;
  restaurantName: string;
  locations: { restaurantId: string; address: string; rdId: string }[];
}

interface SimilarDish {
  name1: string;
  name2: string;
  id1: string;
  id2: string;
  count1: number;
  count2: number;
}

interface DuplicateDishCheckerProps {
  onCleanupDone: () => void;
}

export function DuplicateDishChecker({ onCleanupDone }: DuplicateDishCheckerProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [chainDuplicates, setChainDuplicates] = useState<ChainDuplicate[]>([]);
  const [similarDishes, setSimilarDishes] = useState<SimilarDish[]>([]);
  const [exactDupeCount, setExactDupeCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());

  const runCheck = async () => {
    setChecking(true);
    setChainDuplicates([]);
    setSimilarDishes([]);
    setExactDupeCount(0);

    try {
      // 1. Check exact duplicates (same restaurant_id + dish_id)
      const { data: exactDupes } = await supabase.rpc('deduplicate_restaurant_dishes');
      const exactResult = exactDupes as any;
      setExactDupeCount(exactResult?.duplicates_removed || 0);

      // 2. Find chain restaurants (same name) with overlapping suggested dishes
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('id, name, address')
        .eq('is_active', true);

      if (restaurants) {
        // Group by name
        const nameGroups: Record<string, typeof restaurants> = {};
        restaurants.forEach(r => {
          const key = r.name.toLowerCase().trim();
          if (!nameGroups[key]) nameGroups[key] = [];
          nameGroups[key].push(r);
        });

        const chains = Object.values(nameGroups).filter(g => g.length > 1);

        if (chains.length > 0) {
          const chainRestaurantIds = chains.flat().map(r => r.id);

          const { data: suggestedDishes } = await supabase
            .from('restaurant_dishes')
            .select('id, restaurant_id, dish_id, dish:dishes(name)')
            .eq('status', 'suggested')
            .in('restaurant_id', chainRestaurantIds);

          if (suggestedDishes) {
            // Group by dish name + restaurant name to find overlaps
            const dishMap: Record<string, ChainDuplicate> = {};

            for (const chain of chains) {
              const chainIds = new Set(chain.map(r => r.id));
              const chainDishes = suggestedDishes.filter(sd => chainIds.has(sd.restaurant_id));

              // Group by dish_id
              const byDish: Record<string, typeof chainDishes> = {};
              chainDishes.forEach(cd => {
                if (!byDish[cd.dish_id]) byDish[cd.dish_id] = [];
                byDish[cd.dish_id].push(cd);
              });

              Object.entries(byDish).forEach(([dishId, items]) => {
                if (items.length > 1) {
                  const key = `${chain[0].name}-${dishId}`;
                  dishMap[key] = {
                    dishName: (items[0].dish as any)?.name || 'Onbekend',
                    dishId,
                    restaurantName: chain[0].name,
                    locations: items.map(item => {
                      const rest = chain.find(r => r.id === item.restaurant_id);
                      return {
                        restaurantId: item.restaurant_id,
                        address: rest?.address || '',
                        rdId: item.id,
                      };
                    }),
                  };
                }
              });
            }

            setChainDuplicates(Object.values(dishMap));
          }
        }
      }

      // 3. Find similar dish names in taxonomy (fuzzy)
      const { data: allDishes } = await supabase
        .from('dishes')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (allDishes) {
        const similar: SimilarDish[] = [];
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

        for (let i = 0; i < allDishes.length && similar.length < 50; i++) {
          for (let j = i + 1; j < allDishes.length && similar.length < 50; j++) {
            const n1 = normalize(allDishes[i].name);
            const n2 = normalize(allDishes[j].name);
            if (n1 === n2 && allDishes[i].name !== allDishes[j].name) {
              similar.push({
                name1: allDishes[i].name,
                name2: allDishes[j].name,
                id1: allDishes[i].id,
                id2: allDishes[j].id,
                count1: 0,
                count2: 0,
              });
            }
          }
        }

        // Get usage counts for similar dishes
        if (similar.length > 0) {
          const ids = [...new Set(similar.flatMap(s => [s.id1, s.id2]))];
          const { data: counts } = await supabase
            .from('restaurant_dishes')
            .select('dish_id')
            .in('dish_id', ids);

          if (counts) {
            const countMap: Record<string, number> = {};
            counts.forEach(c => {
              countMap[c.dish_id] = (countMap[c.dish_id] || 0) + 1;
            });
            similar.forEach(s => {
              s.count1 = countMap[s.id1] || 0;
              s.count2 = countMap[s.id2] || 0;
            });
          }
        }

        setSimilarDishes(similar);
      }
    } catch (err) {
      console.error('Duplicate check error:', err);
      toast.error('Controle mislukt');
    } finally {
      setChecking(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    runCheck();
  };

  const handleBulkApproveChain = async (item: ChainDuplicate) => {
    if (!user) return;
    const key = `chain-${item.dishId}-${item.restaurantName}`;
    setActionLoading(prev => new Set(prev).add(key));

    const ids = item.locations.map(l => l.rdId);
    const { error } = await supabase
      .from('restaurant_dishes')
      .update({
        status: 'approved_by_admin',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .in('id', ids);

    if (error) {
      toast.error('Kon niet goedkeuren');
    } else {
      toast.success(`${ids.length} koppelingen goedgekeurd voor \\"${item.dishName}\\"`);
      setChainDuplicates(prev => prev.filter(d => !(d.dishId === item.dishId && d.restaurantName === item.restaurantName)));
      onCleanupDone();
    }

    setActionLoading(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const handleMergeSimilar = async (item: SimilarDish) => {
    const key = `merge-${item.id1}-${item.id2}`;
    setActionLoading(prev => new Set(prev).add(key));

    // Keep the one with more usage, remap the other
    const keepId = item.count1 >= item.count2 ? item.id1 : item.id2;
    const removeId = keepId === item.id1 ? item.id2 : item.id1;

    // Remap restaurant_dishes (avoid creating duplicates)
    const { error: remapError } = await supabase
      .from('restaurant_dishes')
      .update({ dish_id: keepId })
      .eq('dish_id', removeId);

    if (remapError) {
      // Might have conflicts - delete conflicting ones first
      await supabase.rpc('deduplicate_restaurant_dishes');
    }

    // Deactivate the removed dish
    await supabase
      .from('dishes')
      .update({ is_active: false })
      .eq('id', removeId);

    toast.success(`\\"${item.count1 >= item.count2 ? item.name2 : item.name1}\\" samengevoegd met \\"${item.count1 >= item.count2 ? item.name1 : item.name2}\\"`);
    setSimilarDishes(prev => prev.filter(s => !(s.id1 === item.id1 && s.id2 === item.id2)));
    onCleanupDone();

    setActionLoading(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const totalIssues = chainDuplicates.length + similarDishes.length + exactDupeCount;

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleOpen}>
        <Search className="w-4 h-4 mr-2" />
        Controleer duplicaten
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Duplicaten Controle
              {!checking && (
                <Badge variant={totalIssues > 0 ? 'destructive' : 'secondary'}>
                  {totalIssues} {totalIssues === 1 ? 'probleem' : 'problemen'}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {checking ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Controleren...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Exact duplicates */}
              {exactDupeCount > 0 && (
                <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
                  <p className="font-medium flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    {exactDupeCount} exacte duplicaten automatisch opgeschoond
                  </p>
                </div>
              )}

              {/* Chain duplicates */}
              {chainDuplicates.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                    <Link className="w-4 h-4" />
                    Keten-duplicaten ({chainDuplicates.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Hetzelfde gerecht staat bij meerdere vestigingen van dezelfde keten. Je kunt ze in één keer goedkeuren.
                  </p>
                  {chainDuplicates.map((item) => {
                    const key = `chain-${item.dishId}-${item.restaurantName}`;
                    return (
                      <div key={key} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="font-medium text-sm">{item.dishName}</span>
                            <span className="text-muted-foreground text-xs ml-2">
                              @ {item.restaurantName} ({item.locations.length} vestigingen)
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-primary"
                            onClick={() => handleBulkApproveChain(item)}
                            disabled={actionLoading.has(key)}
                          >
                            {actionLoading.has(key) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-1" />
                                Alle goedkeuren
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {item.locations.map((loc) => (
                            <div key={loc.rdId}>📍 {loc.address}</div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Similar dish names */}
              {similarDishes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Vergelijkbare gerechtnamen ({similarDishes.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Deze gerechtnamen lijken duplicaten (zelfde naam, andere schrijfwijze). Samenvoegen behoudt het meest gebruikte.
                  </p>
                  {similarDishes.map((item) => {
                    const key = `merge-${item.id1}-${item.id2}`;
                    return (
                      <div key={key} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <div className="text-sm">
                          <span className="font-medium">"{item.name1}"</span>
                          <span className="text-muted-foreground text-xs ml-1">({item.count1}×)</span>
                          <span className="mx-2 text-muted-foreground">↔</span>
                          <span className="font-medium">"{item.name2}"</span>
                          <span className="text-muted-foreground text-xs ml-1">({item.count2}×)</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMergeSimilar(item)}
                          disabled={actionLoading.has(key)}
                        >
                          {actionLoading.has(key) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Samenvoegen'
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {totalIssues === 0 && exactDupeCount === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Check className="w-12 h-12 mx-auto mb-2 text-primary opacity-50" />
                  <p>Geen duplicaten gevonden! Alles ziet er schoon uit.</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Sluiten</Button>
            {!checking && totalIssues > 0 && (
              <Button onClick={runCheck}>
                <Search className="w-4 h-4 mr-2" />
                Opnieuw controleren
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
