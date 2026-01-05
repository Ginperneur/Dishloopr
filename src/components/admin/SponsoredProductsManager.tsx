import { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, MapPin, UtensilsCrossed } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSponsoredProducts } from '@/hooks/useSponsoredProducts';

interface Dish {
  id: string;
  name: string;
  search_count: number;
}

interface City {
  id: string;
  name: string;
}

export function SponsoredProductsManager() {
  const { products, loading, fetchProducts, calculatePrice } = useSponsoredProducts();
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [newProduct, setNewProduct] = useState({
    dishId: '',
    cityId: '',
    basePrice: 49,
    maxSlots: 5,
    minDuration: 14,
    maxDuration: 60,
    defaultDuration: 30
  });

  const [pricePreview, setPricePreview] = useState<number | null>(null);

  useEffect(() => {
    fetchDishesAndCities();
  }, []);

  useEffect(() => {
    if (newProduct.dishId && newProduct.cityId) {
      previewPrice();
    }
  }, [newProduct.dishId, newProduct.cityId]);

  const fetchDishesAndCities = async () => {
    const [dishRes, cityRes] = await Promise.all([
      supabase.from('dishes').select('id, name, search_count').eq('is_active', true).order('name'),
      supabase.from('cities').select('id, name').eq('is_active', true).order('name')
    ]);
    setDishes(dishRes.data || []);
    setCities(cityRes.data || []);
  };

  const previewPrice = async () => {
    const result = await calculatePrice(newProduct.dishId, newProduct.cityId, newProduct.defaultDuration);
    if (result) {
      setPricePreview(result.price);
    }
  };

  const createProduct = async () => {
    if (!newProduct.dishId || !newProduct.cityId) {
      toast.error('Selecteer een gerecht en stad');
      return;
    }

    setCreating(true);
    
    const { error } = await supabase.from('sponsored_products').insert({
      dish_id: newProduct.dishId,
      city_id: newProduct.cityId,
      base_price: newProduct.basePrice,
      max_slots: newProduct.maxSlots,
      min_duration_days: newProduct.minDuration,
      max_duration_days: newProduct.maxDuration,
      default_duration_days: newProduct.defaultDuration
    });

    if (error) {
      if (error.code === '23505') {
        toast.error('Dit product bestaat al');
      } else {
        toast.error('Kon product niet aanmaken');
      }
    } else {
      toast.success('Product aangemaakt');
      setDialogOpen(false);
      setNewProduct({
        dishId: '',
        cityId: '',
        basePrice: 49,
        maxSlots: 5,
        minDuration: 14,
        maxDuration: 60,
        defaultDuration: 30
      });
      setPricePreview(null);
      fetchProducts();
    }

    setCreating(false);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit product wilt verwijderen?')) return;

    const { error } = await supabase.from('sponsored_products').delete().eq('id', id);

    if (error) {
      toast.error('Kon product niet verwijderen');
    } else {
      toast.success('Product verwijderd');
      fetchProducts();
    }
  };

  const toggleProductStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('sponsored_products')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      toast.error('Kon status niet wijzigen');
    } else {
      toast.success('Status gewijzigd');
      fetchProducts();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sponsored Products (Dish × City)
          </CardTitle>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nieuw Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nieuw Sponsored Product</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label>Gerecht</Label>
                  <Select value={newProduct.dishId} onValueChange={(v) => setNewProduct(p => ({ ...p, dishId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer gerecht" />
                    </SelectTrigger>
                    <SelectContent>
                      {dishes.map(dish => (
                        <SelectItem key={dish.id} value={dish.id}>
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="h-3 w-3" />
                            {dish.name}
                            <Badge variant="secondary" className="text-xs">
                              {dish.search_count} zoekopdrachten
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Stad</Label>
                  <Select value={newProduct.cityId} onValueChange={(v) => setNewProduct(p => ({ ...p, cityId: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer stad" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map(city => (
                        <SelectItem key={city.id} value={city.id}>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3" />
                            {city.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Basisprijs (€)</Label>
                    <Input
                      type="number"
                      min={10}
                      value={newProduct.basePrice}
                      onChange={(e) => setNewProduct(p => ({ ...p, basePrice: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>Max Slots</Label>
                    <Select 
                      value={newProduct.maxSlots.toString()} 
                      onValueChange={(v) => setNewProduct(p => ({ ...p, maxSlots: Number(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 slots</SelectItem>
                        <SelectItem value="7">7 slots</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Min dagen</Label>
                    <Input
                      type="number"
                      min={14}
                      value={newProduct.minDuration}
                      onChange={(e) => setNewProduct(p => ({ ...p, minDuration: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>Standaard</Label>
                    <Input
                      type="number"
                      value={newProduct.defaultDuration}
                      onChange={(e) => setNewProduct(p => ({ ...p, defaultDuration: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>Max dagen</Label>
                    <Input
                      type="number"
                      max={60}
                      value={newProduct.maxDuration}
                      onChange={(e) => setNewProduct(p => ({ ...p, maxDuration: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                {pricePreview !== null && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-sm text-muted-foreground">Berekende prijs (30 dagen):</p>
                    <p className="text-2xl font-bold text-primary">€{pricePreview.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Op basis van populariteit</p>
                  </div>
                )}

                <Button onClick={createProduct} disabled={creating} className="w-full">
                  {creating ? 'Aanmaken...' : 'Product Aanmaken'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Geen sponsored products gevonden
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Gerecht</TableHead>
                <TableHead>Stad</TableHead>
                <TableHead>Basisprijs</TableHead>
                <TableHead>Slots</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map(product => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    {(product.dishes as any)?.name || 'Onbekend'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {(product.cities as any)?.name || 'Onbekend'}
                    </div>
                  </TableCell>
                  <TableCell>€{Number(product.base_price).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={product.available_slots === 0 ? 'destructive' : 'secondary'}>
                      {product.available_slots}/{product.max_slots}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant={product.is_active ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleProductStatus(product.id, product.is_active)}
                    >
                      {product.is_active ? 'Actief' : 'Inactief'}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => deleteProduct(product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
