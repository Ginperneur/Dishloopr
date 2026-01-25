import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Image, Eye, EyeOff, Star, Users, X, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Collection {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  cover_image: string | null;
  city_id: string | null;
  dish_id: string | null;
  cuisine: string | null;
  ambience_tag: string | null;
  is_featured: boolean | null;
  is_active: boolean | null;
  sort_order: number | null;
  seo_title: string | null;
  seo_description: string | null;
  city?: { name: string } | null;
  dish?: { name: string } | null;
  restaurant_count?: number;
}

interface City {
  id: string;
  name: string;
}

interface Dish {
  id: string;
  name: string;
}

interface Restaurant {
  id: string;
  name: string;
  address: string;
  city?: { name: string } | null;
  cuisines: string[] | null;
  images: string[] | null;
}

interface CollectionRestaurant {
  id: string;
  restaurant_id: string;
  collection_id: string;
  sort_order: number | null;
  featured_reason: string | null;
  restaurant: Restaurant;
}

const emptyCollection: Partial<Collection> = {
  title: '',
  slug: '',
  subtitle: '',
  description: '',
  cover_image: '',
  city_id: null,
  dish_id: null,
  cuisine: '',
  ambience_tag: '',
  is_featured: false,
  is_active: true,
  sort_order: 0,
  seo_title: '',
  seo_description: ''
};

export function CollectionsManager() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Partial<Collection> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Restaurant management state
  const [restaurantsDialogOpen, setRestaurantsDialogOpen] = useState(false);
  const [managingCollection, setManagingCollection] = useState<Collection | null>(null);
  const [collectionRestaurants, setCollectionRestaurants] = useState<CollectionRestaurant[]>([]);
  const [allRestaurants, setAllRestaurants] = useState<Restaurant[]>([]);
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    const [collectionsRes, citiesRes, dishesRes] = await Promise.all([
      supabase
        .from('collections')
        .select(`*, city:city_id (name), dish:dish_id (name)`)
        .order('sort_order', { ascending: true }),
      supabase.from('cities').select('id, name').eq('is_active', true).order('name'),
      supabase.from('dishes').select('id, name').eq('is_active', true).order('name')
    ]);

    if (collectionsRes.data) {
      // Get restaurant counts for each collection
      const collectionsWithCounts = await Promise.all(
        (collectionsRes.data as Collection[]).map(async (collection) => {
          const { count } = await supabase
            .from('collection_restaurants')
            .select('*', { count: 'exact', head: true })
            .eq('collection_id', collection.id);
          return { ...collection, restaurant_count: count || 0 };
        })
      );
      setCollections(collectionsWithCounts);
    }
    if (citiesRes.data) setCities(citiesRes.data);
    if (dishesRes.data) setDishes(dishesRes.data);
    
    setLoading(false);
  };

  const fetchCollectionRestaurants = async (collectionId: string) => {
    setLoadingRestaurants(true);
    
    const { data, error } = await supabase
      .from('collection_restaurants')
      .select(`
        *,
        restaurant:restaurant_id (
          id, name, address, cuisines, images,
          city:city_id (name)
        )
      `)
      .eq('collection_id', collectionId)
      .order('sort_order', { ascending: true });
    
    if (data) {
      setCollectionRestaurants(data as unknown as CollectionRestaurant[]);
    }
    
    setLoadingRestaurants(false);
  };

  const fetchAllRestaurants = async (search: string = '') => {
    let query = supabase
      .from('restaurants')
      .select('id, name, address, cuisines, images, city:city_id (name)')
      .eq('is_active', true)
      .order('name')
      .limit(50);
    
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }
    
    const { data } = await query;
    if (data) {
      setAllRestaurants(data as unknown as Restaurant[]);
    }
  };

  const handleManageRestaurants = async (collection: Collection) => {
    setManagingCollection(collection);
    setRestaurantsDialogOpen(true);
    await Promise.all([
      fetchCollectionRestaurants(collection.id),
      fetchAllRestaurants()
    ]);
  };

  const handleAddRestaurant = async (restaurantId: string) => {
    if (!managingCollection) return;
    
    // Check if already in collection
    if (collectionRestaurants.some(cr => cr.restaurant_id === restaurantId)) {
      toast.error('Restaurant zit al in deze collectie');
      return;
    }
    
    const maxOrder = Math.max(0, ...collectionRestaurants.map(cr => cr.sort_order || 0));
    
    const { error } = await supabase
      .from('collection_restaurants')
      .insert({
        collection_id: managingCollection.id,
        restaurant_id: restaurantId,
        sort_order: maxOrder + 1
      });
    
    if (error) {
      toast.error('Toevoegen mislukt: ' + error.message);
      return;
    }
    
    toast.success('Restaurant toegevoegd');
    await fetchCollectionRestaurants(managingCollection.id);
    fetchData(); // Update counts
  };

  const handleRemoveRestaurant = async (collectionRestaurantId: string) => {
    const { error } = await supabase
      .from('collection_restaurants')
      .delete()
      .eq('id', collectionRestaurantId);
    
    if (error) {
      toast.error('Verwijderen mislukt: ' + error.message);
      return;
    }
    
    toast.success('Restaurant verwijderd uit collectie');
    setCollectionRestaurants(prev => prev.filter(cr => cr.id !== collectionRestaurantId));
    fetchData(); // Update counts
  };

  const handleUpdateFeaturedReason = async (collectionRestaurantId: string, reason: string) => {
    const { error } = await supabase
      .from('collection_restaurants')
      .update({ featured_reason: reason || null })
      .eq('id', collectionRestaurantId);
    
    if (error) {
      toast.error('Update mislukt');
      return;
    }
    
    setCollectionRestaurants(prev => 
      prev.map(cr => cr.id === collectionRestaurantId ? { ...cr, featured_reason: reason } : cr)
    );
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleCreate = () => {
    setEditingCollection({ ...emptyCollection });
    setImagePreview(null);
    setDialogOpen(true);
  };

  const handleEdit = (collection: Collection) => {
    setEditingCollection({ ...collection });
    setImagePreview(collection.cover_image);
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Alleen afbeeldingen zijn toegestaan');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Afbeelding mag maximaal 5MB zijn');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('collection-covers')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('collection-covers')
        .getPublicUrl(filePath);

      setEditingCollection(prev => prev ? { ...prev, cover_image: publicUrl } : null);
      setImagePreview(publicUrl);
      toast.success('Afbeelding geüpload');
    } catch (error: any) {
      toast.error('Upload mislukt: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!editingCollection?.title) {
      toast.error('Titel is verplicht');
      return;
    }

    const slug = editingCollection.slug || generateSlug(editingCollection.title);
    
    const dataToSave = {
      title: editingCollection.title,
      slug,
      subtitle: editingCollection.subtitle || null,
      description: editingCollection.description || null,
      cover_image: editingCollection.cover_image || null,
      city_id: editingCollection.city_id || null,
      dish_id: editingCollection.dish_id || null,
      cuisine: editingCollection.cuisine || null,
      ambience_tag: editingCollection.ambience_tag || null,
      is_featured: editingCollection.is_featured ?? false,
      is_active: editingCollection.is_active ?? true,
      sort_order: editingCollection.sort_order ?? 0,
      seo_title: editingCollection.seo_title || null,
      seo_description: editingCollection.seo_description || null
    };

    try {
      if (editingCollection.id) {
        // Update
        const { error } = await supabase
          .from('collections')
          .update(dataToSave)
          .eq('id', editingCollection.id);

        if (error) throw error;
        toast.success('Collectie bijgewerkt');
      } else {
        // Create
        const { error } = await supabase
          .from('collections')
          .insert(dataToSave);

        if (error) throw error;
        toast.success('Collectie aangemaakt');
      }

      setDialogOpen(false);
      setEditingCollection(null);
      fetchData();
    } catch (error: any) {
      toast.error('Opslaan mislukt: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze collectie wilt verwijderen?')) return;

    try {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Collectie verwijderd');
      fetchData();
    } catch (error: any) {
      toast.error('Verwijderen mislukt: ' + error.message);
    }
  };

  const toggleActive = async (id: string, currentValue: boolean | null) => {
    try {
      const { error } = await supabase
        .from('collections')
        .update({ is_active: !currentValue })
        .eq('id', id);

      if (error) throw error;
      
      setCollections(prev => 
        prev.map(c => c.id === id ? { ...c, is_active: !currentValue } : c)
      );
      toast.success(currentValue ? 'Collectie verborgen' : 'Collectie zichtbaar');
    } catch (error: any) {
      toast.error('Update mislukt: ' + error.message);
    }
  };

  const toggleFeatured = async (id: string, currentValue: boolean | null) => {
    try {
      const { error } = await supabase
        .from('collections')
        .update({ is_featured: !currentValue })
        .eq('id', id);

      if (error) throw error;
      
      setCollections(prev => 
        prev.map(c => c.id === id ? { ...c, is_featured: !currentValue } : c)
      );
      toast.success(currentValue ? 'Niet meer uitgelicht' : 'Nu uitgelicht');
    } catch (error: any) {
      toast.error('Update mislukt: ' + error.message);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Collecties beheren</CardTitle>
              <CardDescription>{collections.length} collecties</CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe collectie
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Cover</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Restaurants</TableHead>
                  <TableHead>Filters</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((collection, index) => (
                  <TableRow key={collection.id}>
                    <TableCell>
                      <span className="text-muted-foreground text-sm">{index + 1}</span>
                    </TableCell>
                    <TableCell>
                      {collection.cover_image ? (
                        <img 
                          src={collection.cover_image} 
                          alt={collection.title}
                          className="w-16 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-10 bg-muted rounded flex items-center justify-center">
                          <Image className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{collection.title}</p>
                        {collection.subtitle && (
                          <p className="text-sm text-muted-foreground">{collection.subtitle}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManageRestaurants(collection)}
                        className="gap-1.5"
                      >
                        <Users className="h-4 w-4" />
                        {collection.restaurant_count || 0}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {collection.city?.name && (
                          <Badge variant="outline" className="text-xs">{collection.city.name}</Badge>
                        )}
                        {collection.dish?.name && (
                          <Badge variant="outline" className="text-xs">{collection.dish.name}</Badge>
                        )}
                        {collection.cuisine && (
                          <Badge variant="outline" className="text-xs capitalize">{collection.cuisine}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleActive(collection.id, collection.is_active)}
                        >
                          {collection.is_active ? (
                            <Eye className="h-4 w-4 text-green-600" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleFeatured(collection.id, collection.is_featured)}
                        >
                          <Star className={`h-4 w-4 ${collection.is_featured ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(collection)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(collection.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {collections.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nog geen collecties. Klik op "Nieuwe collectie" om te beginnen.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCollection?.id ? 'Collectie bewerken' : 'Nieuwe collectie'}
            </DialogTitle>
          </DialogHeader>

          {editingCollection && (
            <div className="space-y-6">
              {/* Cover Image */}
              <div className="space-y-2">
                <Label>Cover afbeelding</Label>
                <div className="flex items-start gap-4">
                  {imagePreview ? (
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="w-32 h-20 object-cover rounded-lg border"
                    />
                  ) : (
                    <div className="w-32 h-20 bg-muted rounded-lg border flex items-center justify-center">
                      <Image className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploading}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground">
                      Of voer een URL in:
                    </p>
                    <Input
                      placeholder="https://..."
                      value={editingCollection.cover_image || ''}
                      onChange={(e) => {
                        setEditingCollection({ ...editingCollection, cover_image: e.target.value });
                        setImagePreview(e.target.value);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Titel *</Label>
                  <Input
                    value={editingCollection.title || ''}
                    onChange={(e) => setEditingCollection({ 
                      ...editingCollection, 
                      title: e.target.value,
                      slug: editingCollection.id ? editingCollection.slug : generateSlug(e.target.value)
                    })}
                    placeholder="Beste Ramen in Amsterdam"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={editingCollection.slug || ''}
                    onChange={(e) => setEditingCollection({ ...editingCollection, slug: e.target.value })}
                    placeholder="beste-ramen-amsterdam"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Subtitel</Label>
                <Input
                  value={editingCollection.subtitle || ''}
                  onChange={(e) => setEditingCollection({ ...editingCollection, subtitle: e.target.value })}
                  placeholder="Dampende kommen vol umami"
                />
              </div>

              <div className="space-y-2">
                <Label>Beschrijving</Label>
                <Textarea
                  value={editingCollection.description || ''}
                  onChange={(e) => setEditingCollection({ ...editingCollection, description: e.target.value })}
                  placeholder="Ontdek de beste ramen restaurants..."
                  rows={3}
                />
              </div>

              {/* Filters */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Stad</Label>
                  <Select
                    value={editingCollection.city_id || 'none'}
                    onValueChange={(value) => setEditingCollection({ 
                      ...editingCollection, 
                      city_id: value === 'none' ? null : value 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer stad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geen stad</SelectItem>
                      {cities.map(city => (
                        <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gerecht</Label>
                  <Select
                    value={editingCollection.dish_id || 'none'}
                    onValueChange={(value) => setEditingCollection({ 
                      ...editingCollection, 
                      dish_id: value === 'none' ? null : value 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer gerecht" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Geen gerecht</SelectItem>
                      {dishes.map(dish => (
                        <SelectItem key={dish.id} value={dish.id}>{dish.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Keuken</Label>
                  <Input
                    value={editingCollection.cuisine || ''}
                    onChange={(e) => setEditingCollection({ ...editingCollection, cuisine: e.target.value })}
                    placeholder="italian, japanese, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sfeer tag</Label>
                  <Input
                    value={editingCollection.ambience_tag || ''}
                    onChange={(e) => setEditingCollection({ ...editingCollection, ambience_tag: e.target.value })}
                    placeholder="romantic, cozy, etc."
                  />
                </div>
              </div>

              {/* SEO */}
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium">SEO</h4>
                <div className="space-y-2">
                  <Label>SEO Titel</Label>
                  <Input
                    value={editingCollection.seo_title || ''}
                    onChange={(e) => setEditingCollection({ ...editingCollection, seo_title: e.target.value })}
                    placeholder="Beste Ramen Restaurants Amsterdam | Dishloopr"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SEO Beschrijving</Label>
                  <Textarea
                    value={editingCollection.seo_description || ''}
                    onChange={(e) => setEditingCollection({ ...editingCollection, seo_description: e.target.value })}
                    placeholder="Ontdek de beste ramen restaurants in Amsterdam..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-6 border-t pt-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingCollection.is_active ?? true}
                    onCheckedChange={(checked) => setEditingCollection({ ...editingCollection, is_active: checked })}
                  />
                  <Label>Actief</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingCollection.is_featured ?? false}
                    onCheckedChange={(checked) => setEditingCollection({ ...editingCollection, is_featured: checked })}
                  />
                  <Label>Uitgelicht</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Volgorde:</Label>
                  <Input
                    type="number"
                    className="w-20"
                    value={editingCollection.sort_order ?? 0}
                    onChange={(e) => setEditingCollection({ ...editingCollection, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={uploading}>
              {editingCollection?.id ? 'Opslaan' : 'Aanmaken'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Restaurants Dialog */}
      <Dialog open={restaurantsDialogOpen} onOpenChange={setRestaurantsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Restaurants in "{managingCollection?.title}"
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* Search to add restaurants */}
            <div className="space-y-2">
              <Label>Restaurant toevoegen</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Zoek restaurant..."
                    value={restaurantSearch}
                    onChange={(e) => {
                      setRestaurantSearch(e.target.value);
                      fetchAllRestaurants(e.target.value);
                    }}
                    className="pl-9"
                  />
                </div>
              </div>
              
              {/* Search results dropdown */}
              {restaurantSearch && allRestaurants.length > 0 && (
                <div className="border rounded-lg bg-background shadow-lg max-h-48 overflow-y-auto">
                  {allRestaurants
                    .filter(r => !collectionRestaurants.some(cr => cr.restaurant_id === r.id))
                    .slice(0, 10)
                    .map(restaurant => (
                      <button
                        key={restaurant.id}
                        onClick={() => {
                          handleAddRestaurant(restaurant.id);
                          setRestaurantSearch('');
                        }}
                        className="w-full flex items-center gap-3 p-2 hover:bg-muted text-left transition-colors"
                      >
                        {restaurant.images?.[0] ? (
                          <img src={restaurant.images[0]} alt="" className="w-10 h-10 object-cover rounded" />
                        ) : (
                          <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                            <Image className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{restaurant.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {restaurant.city?.name} • {restaurant.cuisines?.slice(0, 2).join(', ')}
                          </p>
                        </div>
                        <Plus className="h-4 w-4 text-primary shrink-0" />
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Current restaurants in collection */}
            <div className="flex-1 overflow-hidden">
              <Label className="mb-2 block">
                Restaurants in collectie ({collectionRestaurants.length})
              </Label>
              <ScrollArea className="h-[300px] border rounded-lg">
                {loadingRestaurants ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Laden...
                  </div>
                ) : collectionRestaurants.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    Nog geen restaurants in deze collectie
                  </div>
                ) : (
                  <div className="divide-y">
                    {collectionRestaurants.map((cr, index) => (
                      <div key={cr.id} className="flex items-center gap-3 p-3">
                        <span className="text-sm text-muted-foreground w-6">{index + 1}</span>
                        {cr.restaurant.images?.[0] ? (
                          <img src={cr.restaurant.images[0]} alt="" className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                            <Image className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{cr.restaurant.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {cr.restaurant.city?.name} • {cr.restaurant.address}
                          </p>
                          <Input
                            placeholder="Waarom uitgelicht? (optioneel)"
                            value={cr.featured_reason || ''}
                            onChange={(e) => handleUpdateFeaturedReason(cr.id, e.target.value)}
                            className="mt-1 h-7 text-xs"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                          onClick={() => handleRemoveRestaurant(cr.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setRestaurantsDialogOpen(false)}>
              Sluiten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
