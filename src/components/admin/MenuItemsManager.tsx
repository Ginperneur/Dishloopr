import { useState, useEffect } from 'react';
import { 
  UtensilsCrossed, 
  Search, 
  Trash2, 
  Edit2,
  Plus,
  Leaf,
  Wheat,
  ImageIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useActivityLog } from '@/hooks/useActivityLog';

interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  allergens: string[] | null;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_gluten_free: boolean | null;
  image_url: string | null;
  is_available: boolean | null;
}

interface MenuItemsManagerProps {
  restaurantId: string;
  restaurantName?: string;
  onUpdate?: () => void;
  isAdmin?: boolean;
}

const allergenOptions = [
  { value: 'gluten', label: 'Gluten' },
  { value: 'dairy', label: 'Zuivel' },
  { value: 'eggs', label: 'Eieren' },
  { value: 'nuts', label: 'Noten' },
  { value: 'peanuts', label: "Pinda's" },
  { value: 'soy', label: 'Soja' },
  { value: 'fish', label: 'Vis' },
  { value: 'shellfish', label: 'Schaaldieren' },
  { value: 'sesame', label: 'Sesam' },
  { value: 'celery', label: 'Selderij' },
  { value: 'mustard', label: 'Mosterd' },
  { value: 'sulphites', label: 'Sulfieten' },
];

export function MenuItemsManager({ restaurantId, restaurantName, onUpdate, isAdmin = false }: MenuItemsManagerProps) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const { logActivity } = useActivityLog();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    allergens: [] as string[],
    is_vegetarian: false,
    is_vegan: false,
    is_gluten_free: false,
    image_url: '',
    is_available: true,
  });

  useEffect(() => {
    fetchItems();
  }, [restaurantId]);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('category')
      .order('name');

    if (error) {
      toast.error('Fout bij ophalen menu items');
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category: '',
      allergens: [],
      is_vegetarian: false,
      is_vegan: false,
      is_gluten_free: false,
      image_url: '',
      is_available: true,
    });
  };

  const populateForm = (item: MenuItem) => {
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category: item.category,
      allergens: item.allergens || [],
      is_vegetarian: item.is_vegetarian || false,
      is_vegan: item.is_vegan || false,
      is_gluten_free: item.is_gluten_free || false,
      image_url: item.image_url || '',
      is_available: item.is_available ?? true,
    });
  };

  const addItem = async () => {
    if (!formData.name.trim() || !formData.category.trim() || !formData.price) {
      toast.error('Vul alle verplichte velden in');
      return;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price < 0) {
      toast.error('Ongeldige prijs');
      return;
    }

    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        restaurant_id: restaurantId,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price,
        category: formData.category.trim(),
        allergens: formData.allergens,
        is_vegetarian: formData.is_vegetarian,
        is_vegan: formData.is_vegan,
        is_gluten_free: formData.is_gluten_free,
        image_url: formData.image_url.trim() || null,
        is_available: formData.is_available,
      })
      .select()
      .single();

    if (error) {
      toast.error('Toevoegen mislukt: ' + error.message);
    } else {
      if (isAdmin) {
        await logActivity({
          actionType: 'create',
          entityType: 'menu_item',
          entityId: data?.id,
          entityName: formData.name.trim(),
          details: { restaurant_id: restaurantId, restaurant_name: restaurantName }
        });
      }
      toast.success('Menu item toegevoegd');
      resetForm();
      setIsAddDialogOpen(false);
      fetchItems();
      onUpdate?.();
    }
  };

  const updateItem = async () => {
    if (!editingItem) return;

    if (!formData.name.trim() || !formData.category.trim() || !formData.price) {
      toast.error('Vul alle verplichte velden in');
      return;
    }

    const price = parseFloat(formData.price);
    if (isNaN(price) || price < 0) {
      toast.error('Ongeldige prijs');
      return;
    }

    const { error } = await supabase
      .from('menu_items')
      .update({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        price,
        category: formData.category.trim(),
        allergens: formData.allergens,
        is_vegetarian: formData.is_vegetarian,
        is_vegan: formData.is_vegan,
        is_gluten_free: formData.is_gluten_free,
        image_url: formData.image_url.trim() || null,
        is_available: formData.is_available,
      })
      .eq('id', editingItem.id);

    if (error) {
      toast.error('Bijwerken mislukt: ' + error.message);
    } else {
      if (isAdmin) {
        await logActivity({
          actionType: 'update',
          entityType: 'menu_item',
          entityId: editingItem.id,
          entityName: formData.name.trim(),
          details: { restaurant_id: restaurantId, restaurant_name: restaurantName }
        });
      }
      toast.success('Menu item bijgewerkt');
      setEditingItem(null);
      setIsEditDialogOpen(false);
      resetForm();
      fetchItems();
      onUpdate?.();
    }
  };

  const deleteItem = async (id: string, name: string) => {
    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Verwijderen mislukt: ' + error.message);
    } else {
      if (isAdmin) {
        await logActivity({
          actionType: 'delete',
          entityType: 'menu_item',
          entityId: id,
          entityName: name,
          details: { restaurant_id: restaurantId, restaurant_name: restaurantName }
        });
      }
      toast.success('Menu item verwijderd');
      setItems(prev => prev.filter(item => item.id !== id));
      setDeleteConfirmId(null);
      onUpdate?.();
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    const newAvailability = !item.is_available;
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: newAvailability })
      .eq('id', item.id);

    if (error) {
      toast.error('Status bijwerken mislukt');
    } else {
      toast.success(newAvailability ? 'Item beschikbaar' : 'Item niet beschikbaar');
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: newAvailability } : i));
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
    }).format(price);
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = [...new Set(items.map(item => item.category))];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              Menu Items
            </CardTitle>
            <CardDescription>
              {items.length} items{restaurantName ? ` voor ${restaurantName}` : ''}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-1" />
                  Toevoegen
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nieuw menu item</DialogTitle>
                </DialogHeader>
                <MenuItemForm
                  formData={formData}
                  setFormData={setFormData}
                  categories={categories}
                  allergenOptions={allergenOptions}
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Annuleren
                  </Button>
                  <Button onClick={addItem}>
                    Toevoegen
                  </Button>
                </DialogFooter>
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
                <TableHead>Categorie</TableHead>
                <TableHead className="text-right">Prijs</TableHead>
                <TableHead className="text-center">Dieet</TableHead>
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
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Geen menu items gevonden
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {item.image_url && (
                          <img 
                            src={item.image_url} 
                            alt={item.name}
                            className="w-8 h-8 rounded object-cover"
                          />
                        )}
                        <div>
                          <span className="font-medium">{item.name}</span>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-[200px]">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(item.price)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-1">
                        {item.is_vegetarian && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1">
                            <Leaf className="h-3 w-3" />
                          </Badge>
                        )}
                        {item.is_vegan && (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1 text-xs">
                            VG
                          </Badge>
                        )}
                        {item.is_gluten_free && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1">
                            <Wheat className="h-3 w-3" />
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={item.is_available ? 'default' : 'secondary'}
                        className="cursor-pointer"
                        onClick={() => toggleAvailability(item)}
                      >
                        {item.is_available ? 'Beschikbaar' : 'Niet beschikbaar'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingItem(item);
                            populateForm(item);
                            setIsEditDialogOpen(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Dialog open={deleteConfirmId === item.id} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteConfirmId(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Menu item verwijderen?</DialogTitle>
                            </DialogHeader>
                            <p className="text-muted-foreground">
                              Weet je zeker dat je "{item.name}" wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
                            </p>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                                Annuleren
                              </Button>
                              <Button variant="destructive" onClick={() => deleteItem(item.id, item.name)}>
                                Verwijderen
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Menu item bewerken</DialogTitle>
          </DialogHeader>
          <MenuItemForm
            formData={formData}
            setFormData={setFormData}
            categories={categories}
            allergenOptions={allergenOptions}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={updateItem}>
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface MenuItemFormProps {
  formData: {
    name: string;
    description: string;
    price: string;
    category: string;
    allergens: string[];
    is_vegetarian: boolean;
    is_vegan: boolean;
    is_gluten_free: boolean;
    image_url: string;
    is_available: boolean;
  };
  setFormData: React.Dispatch<React.SetStateAction<MenuItemFormProps['formData']>>;
  categories: string[];
  allergenOptions: { value: string; label: string }[];
}

function MenuItemForm({ formData, setFormData, categories, allergenOptions }: MenuItemFormProps) {
  const [newCategory, setNewCategory] = useState('');

  return (
    <div className="space-y-4 pt-2">
      <div>
        <Label>Naam *</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          placeholder="bijv. Margherita Pizza"
        />
      </div>

      <div>
        <Label>Beschrijving</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Korte beschrijving van het gerecht..."
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Prijs (€) *</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.price}
            onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
            placeholder="12.50"
          />
        </div>

        <div>
          <Label>Categorie *</Label>
          {categories.length > 0 ? (
            <Select
              value={formData.category}
              onValueChange={(value) => {
                if (value === '__new__') {
                  setFormData(prev => ({ ...prev, category: '' }));
                } else {
                  setFormData(prev => ({ ...prev, category: value }));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Kies categorie" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat} className="capitalize">
                    {cat}
                  </SelectItem>
                ))}
                <SelectItem value="__new__">+ Nieuwe categorie</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              placeholder="bijv. Hoofdgerechten"
            />
          )}
          {formData.category === '' && categories.length > 0 && (
            <Input
              className="mt-2"
              value={newCategory}
              onChange={(e) => {
                setNewCategory(e.target.value);
                setFormData(prev => ({ ...prev, category: e.target.value }));
              }}
              placeholder="Nieuwe categorie naam"
            />
          )}
        </div>
      </div>

      <div>
        <Label>Dieetopties</Label>
        <div className="flex flex-wrap gap-4 mt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={formData.is_vegetarian}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_vegetarian: !!checked }))}
            />
            <span className="text-sm">Vegetarisch</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={formData.is_vegan}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_vegan: !!checked }))}
            />
            <span className="text-sm">Vegan</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={formData.is_gluten_free}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_gluten_free: !!checked }))}
            />
            <span className="text-sm">Glutenvrij</span>
          </label>
        </div>
      </div>

      <div>
        <Label>Allergenen</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {allergenOptions.map(option => (
            <Badge
              key={option.value}
              variant={formData.allergens.includes(option.value) ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => {
                setFormData(prev => ({
                  ...prev,
                  allergens: prev.allergens.includes(option.value)
                    ? prev.allergens.filter(a => a !== option.value)
                    : [...prev.allergens, option.value]
                }));
              }}
            >
              {option.label}
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <Label>Afbeelding URL</Label>
        <div className="flex gap-2">
          <Input
            value={formData.image_url}
            onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
            placeholder="https://..."
          />
          {formData.image_url && (
            <img 
              src={formData.image_url} 
              alt="Preview" 
              className="w-9 h-9 rounded object-cover"
            />
          )}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={formData.is_available}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_available: !!checked }))}
          />
          <span className="text-sm">Beschikbaar op menu</span>
        </label>
      </div>
    </div>
  );
}
