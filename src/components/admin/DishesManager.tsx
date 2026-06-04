import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  UtensilsCrossed, Search, Plus, Trash2, Edit2, Copy, Loader2, Upload, Sparkles, Leaf, Wheat,
  ChevronLeft, ChevronRight, Eye, EyeOff, X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TagInput } from '@/components/ui/tag-input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActivityLog } from '@/hooks/useActivityLog';
import { formatDishName } from '@/lib/utils';

import { openConfirm } from '@/components/ui/confirm-dialog';
interface Dish {
  id: string;
  name: string;
  slug: string;
  synonyms: string[];
  cuisine_tags: string[];
  seasonal_tags: string[];
  search_count: number;
  is_active: boolean;
  is_halal: boolean;
  is_vegetarian: boolean;
  is_vegan: boolean;
  is_gluten_free: boolean;
  created_at: string;
}

interface DishesManagerProps {
  onUpdate?: () => void;
}

const ITEMS_PER_PAGE = 50;

export function DishesManager({ onUpdate }: DishesManagerProps) {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newDishSynonyms, setNewDishSynonyms] = useState<string[]>([]);
  const [newDishCuisines, setNewDishCuisines] = useState<string[]>([]);
  const { logActivity } = useActivityLog();
  const [deduplicating, setDeduplicating] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [bulkExecuting, setBulkExecuting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchDishes(); }, []);

  const fetchDishes = async () => {
    setLoading(true);
    let allDishes: Dish[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('dishes')
        .select('*')
        .order('name')
        .range(from, from + pageSize - 1);
      
      if (error) {
        toast.error('Fout bij ophalen gerechten');
        setLoading(false);
        return;
      }
      
      allDishes = [...allDishes, ...(data || [])];
      hasMore = (data?.length || 0) === pageSize;
      from += pageSize;
    }

    setDishes(allDishes);
    setLoading(false);
  };

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const handleDeduplicateDishes = async () => {
    if (!(await openConfirm('Wil je alle dubbele gerechten samenvoegen?'))) return;
    setDeduplicating(true);
    try {
      const { data, error } = await supabase.rpc('deduplicate_dishes');
      if (error) throw error;
      const result = data as any;
      if (result?.duplicates_found > 0) {
        toast.success(`${result.dishes_removed} dubbele gerechten verwijderd`);
        await logActivity({ actionType: 'deduplicate', entityType: 'dish', entityName: `${result.dishes_removed} duplicaten` });
      } else {
        toast.info('Geen duplicaten gevonden');
      }
      fetchDishes();
      onUpdate?.();
    } catch {
      toast.error('Deduplicatie mislukt');
    } finally {
      setDeduplicating(false);
    }
  };

  const handleClassify = async (mode: 'all_empty' | 'specific') => {
    setClassifying(true);
    try {
      const body: any = { mode };
      if (mode === 'specific') {
        body.dishIds = Array.from(selected);
      }
      const { data, error } = await supabase.functions.invoke('classify-dishes', { body });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`${data.classified} van ${data.total} gerechten geclassificeerd`);
        await logActivity({ actionType: 'ai_classify', entityType: 'dish', entityName: `${data.classified} gerechten` });
        fetchDishes();
        setSelected(new Set());
        onUpdate?.();
      }
    } catch (err) {
      toast.error('AI-classificatie mislukt');
      console.error(err);
    } finally {
      setClassifying(false);
    }
  };

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV moet minimaal 1 header + 1 rij bevatten');

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIdx = headers.indexOf('name') !== -1 ? headers.indexOf('name') : headers.indexOf('naam');
      if (nameIdx === -1) throw new Error('Kolom "name" of "naam" ontbreekt in CSV');

      const synIdx = headers.findIndex(h => h.includes('synonym') || h.includes('synoniem'));
      const halalIdx = headers.findIndex(h => h.includes('halal'));
      const vegIdx = headers.findIndex(h => h.includes('vegetar'));
      const veganIdx = headers.findIndex(h => h.includes('vegan'));
      const gfIdx = headers.findIndex(h => h.includes('gluten'));
      const cuisineIdx = headers.findIndex(h => h.includes('cuisine') || h.includes('keuken'));

      let updated = 0;
      let created = 0;

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        const name = cols[nameIdx]?.trim();
        if (!name) continue;

        const formattedName = formatDishName(name);
        const synonyms = synIdx >= 0 ? cols[synIdx]?.split(';').map(s => s.trim().toLowerCase()).filter(Boolean) : undefined;
        const cuisines = cuisineIdx >= 0 ? cols[cuisineIdx]?.split(';').map(s => s.trim().toLowerCase()).filter(Boolean) : undefined;
        const isHalal = halalIdx >= 0 ? parseBool(cols[halalIdx]) : undefined;
        const isVeg = vegIdx >= 0 ? parseBool(cols[vegIdx]) : undefined;
        const isVegan = veganIdx >= 0 ? parseBool(cols[veganIdx]) : undefined;
        const isGF = gfIdx >= 0 ? parseBool(cols[gfIdx]) : undefined;

        const existing = dishes.find(d => d.name.toLowerCase() === formattedName.toLowerCase());

        if (existing) {
          const updates: any = {};
          if (synonyms) updates.synonyms = [...new Set([...(existing.synonyms || []), ...synonyms])];
          if (cuisines) updates.cuisine_tags = [...new Set([...(existing.cuisine_tags || []), ...cuisines])];
          if (isHalal !== undefined) updates.is_halal = isHalal;
          if (isVeg !== undefined) updates.is_vegetarian = isVeg;
          if (isVegan !== undefined) updates.is_vegan = isVegan;
          if (isGF !== undefined) updates.is_gluten_free = isGF;

          if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from('dishes').update(updates).eq('id', existing.id);
            if (!error) updated++;
          }
        } else {
          const { error } = await supabase.from('dishes').insert({
            name: formattedName,
            slug: generateSlug(formattedName),
            synonyms: synonyms || [],
            cuisine_tags: cuisines || [],
            is_halal: isHalal ?? false,
            is_vegetarian: isVeg ?? false,
            is_vegan: isVegan ?? false,
            is_gluten_free: isGF ?? false,
            is_active: true,
          });
          if (!error) created++;
        }
      }

      toast.success(`CSV verwerkt: ${created} nieuw, ${updated} bijgewerkt`);
      await logActivity({ actionType: 'csv_import', entityType: 'dish', entityName: `${created} nieuw, ${updated} bijgewerkt` });
      fetchDishes();
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.message || 'CSV-upload mislukt');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const addDish = async () => {
    if (!newDishName.trim()) { toast.error('Geef een naam op'); return; }
    const formattedName = formatDishName(newDishName);
    const { data, error } = await supabase
      .from('dishes')
      .insert({
        name: formattedName,
        slug: generateSlug(formattedName),
        synonyms: newDishSynonyms.map(s => s.toLowerCase()),
        cuisine_tags: newDishCuisines.map(c => c.toLowerCase()),
        is_active: true,
      })
      .select().single();
    if (error) {
      toast.error('Toevoegen mislukt: ' + error.message);
    } else {
      await logActivity({ actionType: 'create', entityType: 'dish', entityId: data?.id, entityName: formattedName });
      toast.success('Gerecht toegevoegd');
      setNewDishName(''); setNewDishSynonyms([]); setNewDishCuisines([]);
      setIsAddDialogOpen(false);
      fetchDishes(); onUpdate?.();
    }
  };

  const updateDish = async (dish: Dish) => {
    const formattedName = formatDishName(dish.name);
    const { error } = await supabase
      .from('dishes')
      .update({
        name: formattedName,
        slug: generateSlug(formattedName),
        synonyms: dish.synonyms?.map(s => s.toLowerCase()),
        cuisine_tags: dish.cuisine_tags?.map(c => c.toLowerCase()),
        is_active: dish.is_active,
        is_halal: dish.is_halal,
        is_vegetarian: dish.is_vegetarian,
        is_vegan: dish.is_vegan,
        is_gluten_free: dish.is_gluten_free,
      })
      .eq('id', dish.id);
    if (error) {
      toast.error('Bijwerken mislukt');
    } else {
      await logActivity({ actionType: 'update', entityType: 'dish', entityId: dish.id, entityName: dish.name });
      toast.success('Gerecht bijgewerkt');
      fetchDishes(); onUpdate?.();
    }
  };

  const toggleDishActive = async (id: string, name: string, isActive: boolean) => {
    const { error } = await supabase.from('dishes').update({ is_active: !isActive }).eq('id', id);
    if (error) {
      toast.error('Status bijwerken mislukt');
    } else {
      await logActivity({ actionType: isActive ? 'deactivate' : 'activate', entityType: 'dish', entityId: id, entityName: name });
      toast.success(isActive ? 'Gerecht gedeactiveerd' : 'Gerecht geactiveerd');
      setDishes(prev => prev.map(d => d.id === id ? { ...d, is_active: !isActive } : d));
    }
  };

  const deleteDish = async (id: string, name: string) => {
    if (!(await openConfirm('Weet je zeker dat je dit gerecht wilt verwijderen?'))) return;
    const { error } = await supabase.from('dishes').delete().eq('id', id);
    if (error) {
      toast.error('Verwijderen mislukt: ' + error.message);
    } else {
      await logActivity({ actionType: 'delete', entityType: 'dish', entityId: id, entityName: name });
      toast.success('Gerecht verwijderd');
      setDishes(prev => prev.filter(d => d.id !== id));
      onUpdate?.();
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // --- Bulk actions ---
  const bulkDelete = async () => {
    if (!(await openConfirm(`Weet je zeker dat je ${selected.size} gerechten wilt verwijderen? Dit kan niet ongedaan worden.`))) return;
    setBulkExecuting(true);
    const ids = Array.from(selected);
    let deleted = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error } = await supabase.from('dishes').delete().in('id', chunk);
      if (!error) deleted += chunk.length;
    }
    await logActivity({ actionType: 'delete', entityType: 'dish', entityName: `Bulk: ${deleted} gerechten verwijderd` });
    toast.success(`${deleted} gerechten verwijderd`);
    setSelected(new Set());
    setBulkExecuting(false);
    fetchDishes();
    onUpdate?.();
  };

  const bulkSetActive = async (active: boolean) => {
    setBulkExecuting(true);
    const ids = Array.from(selected);
    let count = 0;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { error } = await supabase.from('dishes').update({ is_active: active }).in('id', chunk);
      if (!error) count += chunk.length;
    }
    const label = active ? 'geactiveerd' : 'gedeactiveerd';
    await logActivity({ actionType: active ? 'activate' : 'deactivate', entityType: 'dish', entityName: `Bulk: ${count} ${label}` });
    toast.success(`${count} gerechten ${label}`);
    setSelected(new Set());
    setBulkExecuting(false);
    setDishes(prev => prev.map(d => ids.includes(d.id) ? { ...d, is_active: active } : d));
  };

  const filteredDishes = useMemo(() => {
    if (!searchQuery) return dishes;
    const q = searchQuery.toLowerCase();
    return dishes.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.synonyms?.some(s => s.toLowerCase().includes(q))
    );
  }, [dishes, searchQuery]);

  const totalPages = Math.ceil(filteredDishes.length / ITEMS_PER_PAGE);
  const paginatedDishes = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredDishes.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredDishes, page]);

  // Reset page when search changes
  useEffect(() => { setPage(1); }, [searchQuery]);

  const missingDataCount = dishes.filter(d => !d.synonyms?.length).length;

  // Select all on current page only
  const selectAllOnPage = (checked: boolean) => {
    if (checked) {
      const next = new Set(selected);
      paginatedDishes.forEach(d => next.add(d.id));
      setSelected(next);
    } else {
      const pageIds = new Set(paginatedDishes.map(d => d.id));
      setSelected(prev => {
        const next = new Set(prev);
        pageIds.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  const allOnPageSelected = paginatedDishes.length > 0 && paginatedDishes.every(d => selected.has(d.id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" />
                Gerechten beheren
              </CardTitle>
              <CardDescription>
                {dishes.length} gerechten totaal • {missingDataCount} zonder synoniemen
              </CardDescription>
            </div>
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek gerechten..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDeduplicateDishes} disabled={deduplicating}>
              {deduplicating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Copy className="h-4 w-4 mr-1" />}
              Duplicaten
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleClassify(selected.size > 0 ? 'specific' : 'all_empty')}
              disabled={classifying}
            >
              {classifying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
              {selected.size > 0 ? `AI Classificeer (${selected.size})` : `AI Classificeer (${missingDataCount} leeg)`}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                toast.loading('Dieetlabels verrijken...');
                const { data, error } = await supabase.rpc('auto_enrich_dish_dietary_labels');
                toast.dismiss();
                if (error) { toast.error('Fout bij verrijking'); return; }
                const result = data as any;
                toast.success(`${result.dishes_name_detected} gerechten gelabeld, ${result.restaurant_dishes_inherited} koppelingen bijgewerkt`);
                fetchDishes();
              }}
            >
              <Leaf className="h-4 w-4 mr-1" />
              Auto Labels
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCSVUpload}
            />
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              CSV Upload
            </Button>

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Toevoegen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nieuw gerecht toevoegen</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Naam</Label>
                    <Input value={newDishName} onChange={(e) => setNewDishName(e.target.value)} placeholder="bijv. Spaghetti Carbonara" />
                  </div>
                  <div>
                    <Label>Synoniemen</Label>
                    <TagInput tags={newDishSynonyms} onTagsChange={setNewDishSynonyms} placeholder="pasta carbonara, carbonara..." variant="outline" />
                  </div>
                  <div>
                    <Label>Keuken tags</Label>
                    <TagInput tags={newDishCuisines} onTagsChange={setNewDishCuisines} placeholder="italiaans, pasta..." variant="secondary" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Annuleren</Button>
                    <Button onClick={addDish}>Toevoegen</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <p className="text-xs text-muted-foreground">
            CSV-formaat: <code className="bg-muted px-1 rounded">naam,synoniemen,keuken,halal,vegetarisch,veganistisch,glutenvrij</code> — synoniemen/keuken gescheiden met <code className="bg-muted px-1 rounded">;</code>, ja/nee of true/false voor dieetlabels
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-semibold">{selected.size} geselecteerd</Badge>
            <div className="h-4 w-px bg-border" />
            <Button size="sm" variant="outline" onClick={() => bulkSetActive(true)} disabled={bulkExecuting}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              Activeren
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkSetActive(false)} disabled={bulkExecuting}>
              <EyeOff className="h-3.5 w-3.5 mr-1" />
              Deactiveren
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleClassify('specific')} disabled={classifying || bulkExecuting}>
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              AI Classificeer
            </Button>
            <Button size="sm" variant="destructive" onClick={bulkDelete} disabled={bulkExecuting}>
              {bulkExecuting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
              Verwijderen
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="h-3.5 w-3.5 mr-1" />
              Deselecteer
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={(c) => selectAllOnPage(!!c)}
                  />
                </TableHead>
                <TableHead>Naam</TableHead>
                <TableHead>Synoniemen</TableHead>
                <TableHead>Keuken</TableHead>
                <TableHead className="text-center">Dieet</TableHead>
                <TableHead className="text-center">Zoek</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}><div className="h-10 bg-muted rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedDishes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Geen gerechten gevonden</TableCell>
                </TableRow>
              ) : (
                paginatedDishes.map(dish => (
                  <TableRow key={dish.id} className={!dish.synonyms?.length ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''}>
                    <TableCell>
                      <Checkbox checked={selected.has(dish.id)} onCheckedChange={() => toggleSelect(dish.id)} />
                    </TableCell>
                    <TableCell className="font-medium">{formatDishName(dish.name)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {dish.synonyms?.slice(0, 3).map((s, i) => (
                          <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                        ))}
                        {(dish.synonyms?.length || 0) > 3 && (
                          <Badge variant="outline" className="text-xs">+{dish.synonyms.length - 3}</Badge>
                        )}
                        {!dish.synonyms?.length && (
                          <span className="text-xs text-amber-600 dark:text-amber-400">⚠ leeg</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[120px]">
                        {dish.cuisine_tags?.slice(0, 2).map((c, i) => (
                          <Badge key={i} variant="secondary" className="text-xs capitalize">{c}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        {dish.is_halal && <Badge variant="outline" className="text-xs">Halal</Badge>}
                        {dish.is_vegetarian && <Badge variant="outline" className="text-xs text-green-700 dark:text-green-400"><Leaf className="h-3 w-3 mr-0.5" />Veg</Badge>}
                        {dish.is_vegan && <Badge variant="outline" className="text-xs text-emerald-700 dark:text-emerald-400">Vegan</Badge>}
                        {dish.is_gluten_free && <Badge variant="outline" className="text-xs text-amber-700 dark:text-amber-400"><Wheat className="h-3 w-3 mr-0.5" />GV</Badge>}
                        {!dish.is_halal && !dish.is_vegetarian && !dish.is_vegan && !dish.is_gluten_free && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{dish.search_count}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={dish.is_active ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => toggleDishActive(dish.id, dish.name, dish.is_active)}
                      >
                        {dish.is_active ? 'Actief' : 'Inactief'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Gerecht bewerken</DialogTitle>
                            </DialogHeader>
                            <EditDishForm dish={dish} onSave={updateDish} />
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteDish(dish.id, dish.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              {filteredDishes.length} resultaten • Pagina {page} van {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function parseBool(val: string | undefined): boolean | undefined {
  if (!val) return undefined;
  const v = val.trim().toLowerCase();
  if (['true', 'ja', 'yes', '1', 'x'].includes(v)) return true;
  if (['false', 'nee', 'no', '0', ''].includes(v)) return false;
  return undefined;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function EditDishForm({ dish, onSave }: { dish: Dish; onSave: (dish: Dish) => void }) {
  const [name, setName] = useState(dish.name);
  const [synonyms, setSynonyms] = useState<string[]>(dish.synonyms || []);
  const [cuisineTags, setCuisineTags] = useState<string[]>(dish.cuisine_tags || []);
  const [isHalal, setIsHalal] = useState(dish.is_halal);
  const [isVegetarian, setIsVegetarian] = useState(dish.is_vegetarian);
  const [isVegan, setIsVegan] = useState(dish.is_vegan);
  const [isGlutenFree, setIsGlutenFree] = useState(dish.is_gluten_free);

  const handleSave = () => {
    onSave({
      ...dish,
      name,
      synonyms,
      cuisine_tags: cuisineTags,
      is_halal: isHalal,
      is_vegetarian: isVegetarian,
      is_vegan: isVegan,
      is_gluten_free: isGlutenFree,
    });
  };

  return (
    <div className="space-y-4 pt-4">
      <div>
        <Label>Naam</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Synoniemen</Label>
        <TagInput tags={synonyms} onTagsChange={setSynonyms} placeholder="Voeg synoniemen toe..." variant="outline" />
      </div>
      <div>
        <Label>Keuken tags</Label>
        <TagInput tags={cuisineTags} onTagsChange={setCuisineTags} placeholder="italiaans, pasta..." variant="secondary" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <Switch checked={isHalal} onCheckedChange={setIsHalal} />
          <Label>Halal</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isVegetarian} onCheckedChange={setIsVegetarian} />
          <Label>Vegetarisch</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isVegan} onCheckedChange={setIsVegan} />
          <Label>Veganistisch</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={isGlutenFree} onCheckedChange={setIsGlutenFree} />
          <Label>Glutenvrij</Label>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave}>Opslaan</Button>
      </div>
    </div>
  );
}
