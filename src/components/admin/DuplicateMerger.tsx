import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GitMerge, RefreshCw, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useActivityLog } from '@/hooks/useActivityLog';

interface DuplicateGroup {
  key: string;
  type: 'name' | 'address';
  restaurants: {
    id: string;
    name: string;
    slug: string;
    address: string;
    city_name: string;
    is_active: boolean;
    review_count: number;
    rating: number;
    created_at: string;
    images: string[] | null;
  }[];
}

export function DuplicateMerger() {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [merging, setMerging] = useState<string | null>(null);
  const [keepIds, setKeepIds] = useState<Record<string, string>>({});
  const { logActivity } = useActivityLog();

  useEffect(() => {
    findDuplicates();
  }, []);

  const findDuplicates = async () => {
    setLoading(true);

    let allRestaurants: any[] = [];
    let from = 0;
    while (true) {
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, slug, address, is_active, review_count, rating, created_at, images, cities:city_id(name)')
        .range(from, from + 999);
      if (!data || data.length === 0) break;
      allRestaurants = allRestaurants.concat(data);
      if (data.length < 1000) break;
      from += 1000;
    }

    const nameMap = new Map<string, any[]>();
    const addressMap = new Map<string, any[]>();

    allRestaurants.forEach((r: any) => {
      const item = { ...r, city_name: (r.cities as any)?.name || 'Onbekend' };
      
      const normName = r.name?.toLowerCase().trim();
      if (normName) {
        const list = nameMap.get(normName) || [];
        list.push(item);
        nameMap.set(normName, list);
      }

      const normAddr = r.address?.toLowerCase().trim();
      if (normAddr && normAddr.length > 5) {
        const list = addressMap.get(normAddr) || [];
        list.push(item);
        addressMap.set(normAddr, list);
      }
    });

    const dupeGroups: DuplicateGroup[] = [];
    const seen = new Set<string>();

    nameMap.forEach((restaurants, key) => {
      if (restaurants.length > 1) {
        const groupKey = `name:${key}`;
        if (!seen.has(groupKey)) {
          seen.add(groupKey);
          dupeGroups.push({ key: groupKey, type: 'name', restaurants });
        }
      }
    });

    addressMap.forEach((restaurants, key) => {
      if (restaurants.length > 1) {
        const groupKey = `addr:${key}`;
        if (!seen.has(groupKey)) {
          seen.add(groupKey);
          dupeGroups.push({ key: groupKey, type: 'address', restaurants });
        }
      }
    });

    // Sort by group size descending
    dupeGroups.sort((a, b) => b.restaurants.length - a.restaurants.length);
    setGroups(dupeGroups);

    // Default keep to the one with most reviews
    const defaults: Record<string, string> = {};
    dupeGroups.forEach(g => {
      const best = [...g.restaurants].sort((a, b) => b.review_count - a.review_count || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
      defaults[g.key] = best.id;
    });
    setKeepIds(defaults);
    setLoading(false);
  };

  const mergeAll = async () => {
    if (!confirm(`Weet je zeker dat je ALLE ${groups.length} groepen wilt samenvoegen? Dit kan niet ongedaan worden.`)) return;
    setMerging('__all__');
    let merged = 0;
    for (const group of [...groups]) {
      const keepId = keepIds[group.key];
      if (!keepId) continue;
      const removeIds = group.restaurants.filter(r => r.id !== keepId).map(r => r.id);
      const keepRestaurant = group.restaurants.find(r => r.id === keepId)!;
      try {
        for (const removeId of removeIds) {
          await supabase.from('reviews').update({ restaurant_id: keepId }).eq('restaurant_id', removeId);
        }
        for (const removeId of removeIds) {
          const { data: existingDishes } = await supabase.from('restaurant_dishes').select('dish_id').eq('restaurant_id', keepId);
          const existingDishIds = new Set((existingDishes || []).map((d: any) => d.dish_id));
          const { data: moveDishes } = await supabase.from('restaurant_dishes').select('*').eq('restaurant_id', removeId);
          for (const dish of (moveDishes || [])) {
            if (!existingDishIds.has(dish.dish_id)) {
              await supabase.from('restaurant_dishes').update({ restaurant_id: keepId }).eq('id', dish.id);
            } else {
              await supabase.from('restaurant_dishes').delete().eq('id', dish.id);
            }
          }
        }
        for (const removeId of removeIds) {
          await supabase.from('favorites').update({ restaurant_id: keepId }).eq('restaurant_id', removeId);
        }
        for (const removeId of removeIds) {
          await supabase.from('menu_items').update({ restaurant_id: keepId }).eq('restaurant_id', removeId);
        }
        for (const removeId of removeIds) {
          await supabase.from('restaurants').delete().eq('id', removeId);
        }
        const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('restaurant_id', keepId);
        await supabase.from('restaurants').update({ review_count: count || 0 }).eq('id', keepId);
        await logActivity({
          actionType: 'deduplicate',
          entityType: 'restaurant',
          entityId: keepId,
          entityName: keepRestaurant.name,
          details: { merged_ids: removeIds, type: group.type }
        });
        merged++;
        setGroups(prev => prev.filter(g => g.key !== group.key));
      } catch (err) {
        console.error(`Merge failed for ${group.key}`, err);
      }
    }
    toast.success(`${merged} groepen samengevoegd`);
    setMerging(null);
  };

  const mergeGroup = async (group: DuplicateGroup) => {
    const keepId = keepIds[group.key];
    if (!keepId) {
      toast.error('Selecteer welk restaurant je wilt behouden');
      return;
    }

    const removeIds = group.restaurants.filter(r => r.id !== keepId).map(r => r.id);
    const keepRestaurant = group.restaurants.find(r => r.id === keepId)!;

    if (!confirm(`Weet je zeker dat je ${removeIds.length} duplica(a)t(en) wilt samenvoegen naar \\"${keepRestaurant.name}\\"? Reviews, gerechten en favorieten worden overgezet.`)) return;

    setMerging(group.key);

    try {
      // Move reviews
      for (const removeId of removeIds) {
        await supabase.from('reviews').update({ restaurant_id: keepId }).eq('restaurant_id', removeId);
      }

      // Move restaurant_dishes (only if not already linked)
      for (const removeId of removeIds) {
        const { data: existingDishes } = await supabase.from('restaurant_dishes').select('dish_id').eq('restaurant_id', keepId);
        const existingDishIds = new Set((existingDishes || []).map((d: any) => d.dish_id));

        const { data: moveDishes } = await supabase.from('restaurant_dishes').select('*').eq('restaurant_id', removeId);
        for (const dish of (moveDishes || [])) {
          if (!existingDishIds.has(dish.dish_id)) {
            await supabase.from('restaurant_dishes').update({ restaurant_id: keepId }).eq('id', dish.id);
          } else {
            await supabase.from('restaurant_dishes').delete().eq('id', dish.id);
          }
        }
      }

      // Move favorites
      for (const removeId of removeIds) {
        await supabase.from('favorites').update({ restaurant_id: keepId }).eq('restaurant_id', removeId);
      }

      // Move menu items
      for (const removeId of removeIds) {
        await supabase.from('menu_items').update({ restaurant_id: keepId }).eq('restaurant_id', removeId);
      }

      // Delete duplicate restaurants
      for (const removeId of removeIds) {
        await supabase.from('restaurants').delete().eq('id', removeId);
      }

      // Update review count on kept restaurant
      const { count } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('restaurant_id', keepId);
      await supabase.from('restaurants').update({ review_count: count || 0 }).eq('id', keepId);

      await logActivity({
        actionType: 'deduplicate',
        entityType: 'restaurant',
        entityId: keepId,
        entityName: keepRestaurant.name,
        details: { merged_ids: removeIds, type: group.type }
      });

      toast.success(`${removeIds.length} duplica(a)t(en) samengevoegd`);
      setGroups(prev => prev.filter(g => g.key !== group.key));
    } catch (err) {
      toast.error('Samenvoegen mislukt');
      console.error(err);
    }

    setMerging(null);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Duplicaten zoeken...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5" />
              Duplicate Merger
            </CardTitle>
            <CardDescription>
              {groups.length} groepen met mogelijke duplicaten gevonden
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {groups.length > 0 && (
              <Button
                size="sm"
                onClick={mergeAll}
                disabled={!!merging}
              >
                <GitMerge className="h-4 w-4 mr-1" />
                {merging === '__all__' ? 'Bezig...' : `Alles samenvoegen (${groups.length})`}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={findDuplicates}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Opnieuw zoeken
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Geen duplicaten gevonden! 🎉</p>
        ) : (
          <div className="space-y-6">
            {groups.slice(0, 20).map(group => (
              <div key={group.key} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium text-sm">
                      {group.type === 'name' ? 'Dubbele naam' : 'Dubbel adres'}: {group.restaurants.length}x
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {group.type === 'name' ? group.restaurants[0].name : group.restaurants[0].address}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => mergeGroup(group)}
                    disabled={merging === group.key}
                  >
                    <GitMerge className="h-3.5 w-3.5 mr-1" />
                    {merging === group.key ? 'Bezig...' : 'Samenvoegen'}
                  </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">Behoud</TableHead>
                      <TableHead>Naam</TableHead>
                      <TableHead>Adres</TableHead>
                      <TableHead>Stad</TableHead>
                      <TableHead>Reviews</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.restaurants.map(r => (
                      <TableRow key={r.id} className={keepIds[group.key] === r.id ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'opacity-60'}>
                        <TableCell>
                          <input
                            type="radio"
                            name={group.key}
                            checked={keepIds[group.key] === r.id}
                            onChange={() => setKeepIds(prev => ({ ...prev, [group.key]: r.id }))}
                            className="accent-emerald-600"
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm">{r.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.address}</TableCell>
                        <TableCell className="text-sm">{r.city_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{r.review_count} reviews</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.is_active ? 'default' : 'secondary'} className="text-xs">
                            {r.is_active ? 'Actief' : 'Inactief'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
            {groups.length > 20 && (
              <p className="text-xs text-muted-foreground text-center">
                Top 20 getoond van {groups.length} groepen
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
