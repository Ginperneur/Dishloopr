import { useState, useEffect } from 'react';
import { 
  UtensilsCrossed, 
  Search, 
  Plus, 
  Trash2, 
  Edit2,
  Check,
  X,
  Tag,
  Copy,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { TagInput } from '@/components/ui/tag-input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActivityLog } from '@/hooks/useActivityLog';
import { formatDishName } from '@/lib/utils';

interface Dish {
  id: string;
  name: string;
  slug: string;
  synonyms: string[];
  cuisine_tags: string[];
  seasonal_tags: string[];
  search_count: number;
  is_active: boolean;
  created_at: string;
}

interface DishesManagerProps {
  onUpdate?: () => void;
}

export function DishesManager({ onUpdate }: DishesManagerProps) {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newDishSynonyms, setNewDishSynonyms] = useState<string[]>([]);
  const [newDishCuisines, setNewDishCuisines] = useState<string[]>([]);
  const { logActivity } = useActivityLog();
  const [deduplicating, setDeduplicating] = useState(false);

  useEffect(() => {
    fetchDishes();
  }, []);

  const handleDeduplicateDishes = async () => {
    if (!confirm('Wil je alle dubbele gerechten samenvoegen? Het oudste gerecht wordt behouden en restaurant-koppelingen worden overgenomen.')) return;
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
    } catch (err) {
      toast.error('Deduplicatie mislukt');
      console.error(err);
    } finally {
      setDeduplicating(false);
    }
  };

  const fetchDishes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('dishes')
      .select('*')
      .order('name');

    if (error) {
      toast.error('Fout bij ophalen gerechten');
    } else {
      setDishes(data || []);
    }
    setLoading(false);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const addDish = async () => {
    if (!newDishName.trim()) {
      toast.error('Geef een naam op');
      return;
    }

    const formattedName = formatDishName(newDishName);
    
    const { data, error } = await supabase
      .from('dishes')
      .insert({
        name: formattedName,
        slug: generateSlug(formattedName),
        synonyms: newDishSynonyms.map(s => s.toLowerCase()),
        cuisine_tags: newDishCuisines.map(c => c.toLowerCase()),
        is_active: true
      })
      .select()
      .single();

    if (error) {
      toast.error('Toevoegen mislukt: ' + error.message);
    } else {
      await logActivity({
        actionType: 'create',
        entityType: 'dish',
        entityId: data?.id,
        entityName: formattedName
      });
      toast.success('Gerecht toegevoegd');
      setNewDishName('');
      setNewDishSynonyms([]);
      setNewDishCuisines([]);
      setIsAddDialogOpen(false);
      fetchDishes();
      onUpdate?.();
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
        is_active: dish.is_active
      })
      .eq('id', dish.id);

    if (error) {
      toast.error('Bijwerken mislukt');
    } else {
      await logActivity({
        actionType: 'update',
        entityType: 'dish',
        entityId: dish.id,
        entityName: dish.name
      });
      toast.success('Gerecht bijgewerkt');
      setEditingDish(null);
      fetchDishes();
      onUpdate?.();
    }
  };

  const toggleDishActive = async (id: string, name: string, isActive: boolean) => {
    const { error } = await supabase
      .from('dishes')
      .update({ is_active: !isActive })
      .eq('id', id);

    if (error) {
      toast.error('Status bijwerken mislukt');
    } else {
      await logActivity({
        actionType: isActive ? 'deactivate' : 'activate',
        entityType: 'dish',
        entityId: id,
        entityName: name
      });
      toast.success(isActive ? 'Gerecht gedeactiveerd' : 'Gerecht geactiveerd');
      setDishes(prev => prev.map(d => d.id === id ? { ...d, is_active: !isActive } : d));
    }
  };

  const deleteDish = async (id: string, name: string) => {
    if (!confirm('Weet je zeker dat je dit gerecht wilt verwijderen?')) return;

    const { error } = await supabase
      .from('dishes')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Verwijderen mislukt: ' + error.message);
    } else {
      await logActivity({
        actionType: 'delete',
        entityType: 'dish',
        entityId: id,
        entityName: name
      });
      toast.success('Gerecht verwijderd');
      setDishes(prev => prev.filter(d => d.id !== id));
      onUpdate?.();
    }
  };

  const filteredDishes = dishes.filter(d =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.synonyms?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              Gerechten beheren
            </CardTitle>
            <CardDescription>{dishes.length} gerechten totaal</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek gerechten..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
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
                    <Input
                      value={newDishName}
                      onChange={(e) => setNewDishName(e.target.value)}
                      placeholder="bijv. Spaghetti Carbonara"
                    />
                  </div>
                  <div>
                    <Label>Synoniemen</Label>
                    <TagInput
                      tags={newDishSynonyms}
                      onTagsChange={setNewDishSynonyms}
                      placeholder="pasta carbonara, carbonara..."
                      variant="outline"
                    />
                  </div>
                  <div>
                    <Label>Keuken tags</Label>
                    <TagInput
                      tags={newDishCuisines}
                      onTagsChange={setNewDishCuisines}
                      placeholder="italiaans, pasta..."
                      variant="secondary"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Annuleren
                    </Button>
                    <Button onClick={addDish}>
                      Toevoegen
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naam</TableHead>
                <TableHead>Synoniemen</TableHead>
                <TableHead>Keuken</TableHead>
                <TableHead className="text-center">Zoekopdrachten</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <div className="h-10 bg-muted rounded animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredDishes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Geen gerechten gevonden
                  </TableCell>
                </TableRow>
              ) : (
                filteredDishes.map(dish => (
                  <TableRow key={dish.id}>
                    <TableCell className="font-medium">{formatDishName(dish.name)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {dish.synonyms?.slice(0, 3).map((s, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                        {dish.synonyms?.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{dish.synonyms.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {dish.cuisine_tags?.slice(0, 2).map((c, i) => (
                          <Badge key={i} variant="secondary" className="text-xs capitalize">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {dish.search_count}
                    </TableCell>
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
                          variant="ghost"
                          size="icon"
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
      </CardContent>
    </Card>
  );
}

function EditDishForm({ dish, onSave }: { dish: Dish; onSave: (dish: Dish) => void }) {
  const [name, setName] = useState(dish.name);
  const [synonyms, setSynonyms] = useState<string[]>(dish.synonyms || []);
  const [cuisineTags, setCuisineTags] = useState<string[]>(dish.cuisine_tags || []);

  const handleSave = () => {
    onSave({
      ...dish,
      name,
      synonyms,
      cuisine_tags: cuisineTags
    });
  };

  return (
    <div className="space-y-4 pt-4">
      <div>
        <Label>Naam</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <Label>Synoniemen</Label>
        <TagInput
          tags={synonyms}
          onTagsChange={setSynonyms}
          placeholder="Voeg synoniemen toe..."
          variant="outline"
        />
      </div>
      <div>
        <Label>Keuken tags</Label>
        <TagInput
          tags={cuisineTags}
          onTagsChange={setCuisineTags}
          placeholder="italiaans, pasta..."
          variant="secondary"
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave}>
          Opslaan
        </Button>
      </div>
    </div>
  );
}
