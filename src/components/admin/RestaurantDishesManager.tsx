import { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Store, UtensilsCrossed, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  city_id: string;
  cities?: { name: string } | null;
}

interface Dish {
  id: string;
  name: string;
  name_en: string | null;
  slug: string;
}

interface RestaurantDish {
  id: string;
  restaurant_id: string;
  dish_id: string;
  status: string | null;
  confidence_score: number;
  source: string | null;
  created_at: string;
  dishes?: Dish | null;
}

export function RestaurantDishesManager() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('');
  const [restaurantDishes, setRestaurantDishes] = useState<RestaurantDish[]>([]);
  const [availableDishes, setAvailableDishes] = useState<Dish[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dishSearchQuery, setDishSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedDishToAdd, setSelectedDishToAdd] = useState<string>('');

  useEffect(() => {
    fetchRestaurants();
    fetchAllDishes();
  }, []);

  useEffect(() => {
    if (selectedRestaurant) {
      fetchRestaurantDishes();
    }
  }, [selectedRestaurant]);

  const fetchRestaurants = async () => {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, name, slug, city_id, cities:city_id(name)')
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast.error('Fout bij laden restaurants');
      return;
    }
    setRestaurants(data || []);
    setLoading(false);
  };

  const fetchAllDishes = async () => {
    const { data, error } = await supabase
      .from('dishes')
      .select('id, name, name_en, slug')
      .eq('is_active', true)
      .order('name');

    if (error) {
      toast.error('Fout bij laden gerechten');
      return;
    }
    setAvailableDishes(data || []);
  };

  const fetchRestaurantDishes = async () => {
    const { data, error } = await supabase
      .from('restaurant_dishes')
      .select('*, dishes:dish_id(id, name, name_en, slug)')
      .eq('restaurant_id', selectedRestaurant)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Fout bij laden restaurant gerechten');
      return;
    }
    setRestaurantDishes(data || []);
  };

  const addDishToRestaurant = async () => {
    if (!selectedRestaurant || !selectedDishToAdd) {
      toast.error('Selecteer een gerecht');
      return;
    }

    // Check if already exists
    const exists = restaurantDishes.some(rd => rd.dish_id === selectedDishToAdd);
    if (exists) {
      toast.error('Dit gerecht is al toegevoegd');
      return;
    }

    const { error } = await supabase
      .from('restaurant_dishes')
      .insert({
        restaurant_id: selectedRestaurant,
        dish_id: selectedDishToAdd,
        status: 'verified_by_owner',
        confidence_score: 1.0,
        source: 'admin'
      });

    if (error) {
      toast.error('Fout bij toevoegen: ' + error.message);
      return;
    }

    toast.success('Gerecht toegevoegd');
    setAddDialogOpen(false);
    setSelectedDishToAdd('');
    fetchRestaurantDishes();
  };

  const removeDish = async (id: string) => {
    if (!confirm('Weet je zeker dat je dit gerecht wilt verwijderen?')) return;

    const { error } = await supabase
      .from('restaurant_dishes')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Fout bij verwijderen');
      return;
    }

    toast.success('Gerecht verwijderd');
    setRestaurantDishes(prev => prev.filter(rd => rd.id !== id));
  };

  const updateDishStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('restaurant_dishes')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error('Fout bij bijwerken status');
      return;
    }

    toast.success('Status bijgewerkt');
    setRestaurantDishes(prev => prev.map(rd => 
      rd.id === id ? { ...rd, status } : rd
    ));
  };

  const filteredRestaurants = restaurants.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAvailableDishes = availableDishes.filter(d =>
    d.name.toLowerCase().includes(dishSearchQuery.toLowerCase()) ||
    (d.name_en && d.name_en.toLowerCase().includes(dishSearchQuery.toLowerCase()))
  );

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'verified_by_owner':
        return <Badge className="bg-green-500">Geverifieerd</Badge>;
      case 'approved_by_admin':
        return <Badge className="bg-blue-500">Goedgekeurd</Badge>;
      case 'suggested':
        return <Badge variant="secondary">Voorgesteld</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Afgewezen</Badge>;
      default:
        return <Badge variant="outline">{status || 'Onbekend'}</Badge>;
    }
  };

  const getSourceBadge = (source: string | null) => {
    switch (source) {
      case 'admin':
        return <Badge variant="outline" className="text-xs">Admin</Badge>;
      case 'owner':
        return <Badge variant="outline" className="text-xs">Eigenaar</Badge>;
      case 'user_review':
        return <Badge variant="outline" className="text-xs">Review</Badge>;
      case 'cuisine_rules':
        return <Badge variant="outline" className="text-xs">Auto</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{source || '-'}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5" />
          Bekend Om Gerechten
        </CardTitle>
        <CardDescription>
          Beheer welke gerechten bij een restaurant horen (de "bekend om" sectie)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Restaurant Selection */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek restaurant..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
            <SelectTrigger className="w-full sm:w-[300px]">
              <SelectValue placeholder="Selecteer restaurant" />
            </SelectTrigger>
            <SelectContent>
              {filteredRestaurants.map((restaurant) => (
                <SelectItem key={restaurant.id} value={restaurant.id}>
                  <div className="flex items-center gap-2">
                    <Store className="h-3 w-3" />
                    {restaurant.name}
                    {restaurant.cities && (
                      <span className="text-muted-foreground text-xs">
                        ({restaurant.cities.name})
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Restaurant Dishes */}
        {selectedRestaurant ? (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {restaurantDishes.length} gerechten gekoppeld
              </p>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Gerecht Toevoegen
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Gerecht Toevoegen</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="Zoek gerecht..."
                      value={dishSearchQuery}
                      onChange={(e) => setDishSearchQuery(e.target.value)}
                    />
                    <div className="max-h-[300px] overflow-y-auto space-y-1">
                      {filteredAvailableDishes.slice(0, 50).map((dish) => {
                        const isAdded = restaurantDishes.some(rd => rd.dish_id === dish.id);
                        return (
                          <div
                            key={dish.id}
                            className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                              selectedDishToAdd === dish.id
                                ? 'border-primary bg-primary/5'
                                : isAdded
                                ? 'border-green-500/30 bg-green-500/5 opacity-50'
                                : 'hover:bg-muted'
                            }`}
                            onClick={() => !isAdded && setSelectedDishToAdd(dish.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{dish.name}</p>
                                {dish.name_en && (
                                  <p className="text-xs text-muted-foreground">{dish.name_en}</p>
                                )}
                              </div>
                              {isAdded && (
                                <Badge variant="secondary" className="text-xs">Al toegevoegd</Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Button 
                      onClick={addDishToRestaurant} 
                      disabled={!selectedDishToAdd}
                      className="w-full"
                    >
                      Toevoegen
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gerecht</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Bron</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="w-[100px]">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {restaurantDishes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nog geen gerechten gekoppeld
                    </TableCell>
                  </TableRow>
                ) : (
                  restaurantDishes.map((rd) => (
                    <TableRow key={rd.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{rd.dishes?.name || 'Onbekend'}</p>
                          {rd.dishes?.name_en && (
                            <p className="text-xs text-muted-foreground">{rd.dishes.name_en}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(rd.status)}</TableCell>
                      <TableCell>{getSourceBadge(rd.source)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {(rd.confidence_score * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {rd.status !== 'verified_by_owner' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => updateDishStatus(rd.id, 'verified_by_owner')}
                              title="Verifiëren"
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => removeDish(rd.id)}
                            title="Verwijderen"
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
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Store className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Selecteer een restaurant om gerechten te beheren</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
