import { useState } from 'react';
import { useRestaurantDishes, RestaurantDish, Dish } from '@/hooks/useRestaurantDishes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, X, Plus, Loader2, ChefHat, AlertCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn, formatDishName } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface DishConfirmationProps {
  restaurantId: string;
  restaurantName: string;
}

export function DishConfirmation({ restaurantId, restaurantName }: DishConfirmationProps) {
  const { t, i18n } = useTranslation();
  const isNL = i18n.language === 'nl';
  
  const {
    dishes,
    availableDishes,
    loading,
    verifyDish,
    rejectDish,
    suggestDish,
    deleteDish,
  } = useRestaurantDishes({ restaurantId });

  const [addDishOpen, setAddDishOpen] = useState(false);
  const [selectedDishId, setSelectedDishId] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewDishForm, setShowNewDishForm] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newDishNameEn, setNewDishNameEn] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const suggestedDishes = dishes.filter((d) => d.status === 'suggested');
  const confirmedDishes = dishes.filter((d) => 
    d.status === 'verified_by_owner' || d.status === 'approved_by_admin'
  );
  const existingDishIds = dishes.map((d) => d.dish_id);

  const availableToAdd = availableDishes.filter(
    (d) => !existingDishIds.includes(d.id)
  );

  const filteredDishes = availableToAdd.filter((d) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      d.name.toLowerCase().includes(query) ||
      d.name_en?.toLowerCase().includes(query) ||
      d.synonyms?.some((s) => s.toLowerCase().includes(query))
    );
  });

  const getDishName = (dish: Dish | RestaurantDish['dish']) => {
    if (!dish) return '';
    const name = isNL ? dish.name : (dish.name_en || dish.name);
    return formatDishName(name);
  };

  const handleConfirm = async (id: string) => {
    await verifyDish(id);
  };

  const handleReject = async (id: string) => {
    await rejectDish(id, 'Afgewezen door eigenaar');
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleCreateAndAddDish = async () => {
    if (!newDishName.trim()) {
      toast.error(isNL ? 'Vul een gerechtnaam in' : 'Enter a dish name');
      return;
    }
    setIsCreating(true);
    try {
      const slug = generateSlug(newDishName);
      const { data: newDish, error } = await supabase
        .from('dishes')
        .insert({
          name: newDishName.trim(),
          name_en: newDishNameEn.trim() || null,
          slug,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          toast.error(isNL ? 'Dit gerecht bestaat al' : 'This dish already exists');
        } else {
          toast.error(isNL ? 'Kon gerecht niet aanmaken' : 'Could not create dish');
        }
        return;
      }

      await suggestDish(restaurantId, newDish.id, 1.0, 'owner');
      setAddDishOpen(false);
      setNewDishName('');
      setNewDishNameEn('');
      setShowNewDishForm(false);
      toast.success(isNL ? 'Nieuw gerecht aangemaakt en toegevoegd' : 'New dish created and added');
    } catch {
      toast.error(isNL ? 'Er ging iets mis' : 'Something went wrong');
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddDish = async () => {
    if (!selectedDishId) {
      toast.error('Selecteer een gerecht');
      return;
    }
    
    await suggestDish(restaurantId, selectedDishId, 1.0, 'owner');
    const newDish = dishes.find((d) => d.dish_id === selectedDishId);
    if (newDish) {
      await verifyDish(newDish.id);
    }
    
    setAddDishOpen(false);
    setSelectedDishId('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <ChefHat className="w-8 h-8 text-primary shrink-0" />
            <div>
              <p className="font-medium mb-1">
                {isNL
                  ? 'Bevestig je gerechten'
                  : 'Confirm your dishes'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isNL
                  ? 'Dishloopr stelt gerechten voor op basis van je type keuken. Bevestig wat klopt zodat gasten je beter kunnen vinden.'
                  : 'Dishloopr suggests dishes based on your cuisine type. Confirm what\'s correct so guests can find you faster.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggested Dishes */}
      {suggestedDishes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isNL ? 'Voorgestelde Gerechten' : 'Suggested Dishes'}
            </CardTitle>
            <CardDescription>
              {isNL
                ? 'Bevestig of verwijder deze suggesties'
                : 'Confirm or remove these suggestions'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {suggestedDishes.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <span className="font-medium">{getDishName(item.dish)}</span>
                    {item.dish?.name_en && isNL && (
                      <span className="text-muted-foreground text-sm ml-2">
                        ({item.dish.name_en})
                      </span>
                    )}
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary">
                        {Math.round(item.confidence_score * 100)}% match
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => handleConfirm(item.id)}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      {isNL ? 'Bevestig' : 'Confirm'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleReject(item.id)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      {isNL ? 'Verwijder' : 'Remove'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmed Dishes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              {isNL ? 'Bevestigde Gerechten' : 'Confirmed Dishes'}
            </CardTitle>
            <CardDescription>
              {isNL
                ? 'Deze gerechten zijn zichtbaar voor gasten'
                : 'These dishes are visible to guests'}
            </CardDescription>
          </div>
          <Button onClick={() => setAddDishOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {isNL ? 'Gerecht Toevoegen' : 'Add Dish'}
          </Button>
        </CardHeader>
        <CardContent>
          {confirmedDishes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{isNL ? 'Nog geen bevestigde gerechten' : 'No confirmed dishes yet'}</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {confirmedDishes.map((item) => (
                <Badge
                  key={item.id}
                  variant="secondary"
                  className="px-3 py-2 text-sm flex items-center gap-2"
                >
                  {getDishName(item.dish)}
                  <button
                    onClick={() => deleteDish(item.id)}
                    className="hover:text-destructive transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dish Dialog */}
      <Dialog open={addDishOpen} onOpenChange={(open) => {
        setAddDishOpen(open);
        if (!open) { setShowNewDishForm(false); setNewDishName(''); setNewDishNameEn(''); setSelectedDishId(''); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isNL ? 'Gerecht Toevoegen' : 'Add Dish'}
            </DialogTitle>
          </DialogHeader>

          {!showNewDishForm ? (
            <div className="space-y-4">
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={searchOpen}
                    className="w-full justify-between"
                  >
                    {selectedDishId
                      ? getDishName(availableDishes.find((d) => d.id === selectedDishId))
                      : isNL ? 'Selecteer gerecht...' : 'Select dish...'}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder={isNL ? 'Zoek gerecht...' : 'Search dish...'}
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {isNL ? 'Geen gerechten gevonden' : 'No dishes found'}
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredDishes.slice(0, 50).map((dish) => (
                          <CommandItem
                            key={dish.id}
                            value={dish.id}
                            onSelect={() => {
                              setSelectedDishId(dish.id);
                              setSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedDishId === dish.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <div>
                              <div>{getDishName(dish)}</div>
                              {dish.name_en && isNL && (
                                <div className="text-xs text-muted-foreground">
                                  {dish.name_en}
                                </div>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                className="w-full text-primary"
                onClick={() => setShowNewDishForm(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                {isNL ? 'Nieuw gerecht aanmaken' : 'Create new dish'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{isNL ? 'Gerechtnaam (NL)' : 'Dish name (NL)'} *</Label>
                <Input
                  value={newDishName}
                  onChange={(e) => setNewDishName(e.target.value)}
                  placeholder={isNL ? 'Bijv. Rendang' : 'E.g. Rendang'}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label>{isNL ? 'Engelse naam (optioneel)' : 'English name (optional)'}</Label>
                <Input
                  value={newDishNameEn}
                  onChange={(e) => setNewDishNameEn(e.target.value)}
                  placeholder={isNL ? 'Bijv. Rendang' : 'E.g. Rendang'}
                  maxLength={200}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewDishForm(false)}
              >
                {isNL ? '← Terug naar lijst' : '← Back to list'}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDishOpen(false)}>
              {isNL ? 'Annuleren' : 'Cancel'}
            </Button>
            {showNewDishForm ? (
              <Button onClick={handleCreateAndAddDish} disabled={!newDishName.trim() || isCreating}>
                {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isNL ? 'Aanmaken & Toevoegen' : 'Create & Add'}
              </Button>
            ) : (
              <Button onClick={handleAddDish} disabled={!selectedDishId}>
                {isNL ? 'Toevoegen' : 'Add'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
