import { useState } from 'react';
import { useRestaurantDishes, RestaurantDish, Dish } from '@/hooks/useRestaurantDishes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Plus, Loader2, ChefHat, AlertCircle, Search, Leaf, Wheat, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn, formatDishName } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { COURSE_TYPE_LABELS, COURSE_TYPE_ORDER, type CourseType } from '@/hooks/useMenuItems';

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
    refetch,
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
  const signatureCount = confirmedDishes.filter((d: any) => d.is_signature).length;
  const SIGNATURE_MAX = 5;
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

  const toggleDietaryOption = async (dishId: string, field: string, currentValue: boolean) => {
    const { error } = await supabase
      .from('restaurant_dishes')
      .update({ [field]: !currentValue })
      .eq('id', dishId);

    if (error) {
      toast.error('Kon niet bijwerken');
      return;
    }
    toast.success('Bijgewerkt');
    refetch();
  };

  const toggleSignature = async (dishId: string, currentValue: boolean) => {
    if (!currentValue && signatureCount >= SIGNATURE_MAX) {
      toast.error(isNL
        ? `Maximaal ${SIGNATURE_MAX} "Bekend om" gerechten`
        : `Maximum ${SIGNATURE_MAX} "Known for" dishes`);
      return;
    }
    const { error } = await supabase
      .from('restaurant_dishes')
      .update({ is_signature: !currentValue })
      .eq('id', dishId);
    if (error) {
      toast.error(isNL ? 'Kon niet bijwerken' : 'Could not update');
      return;
    }
    toast.success(!currentValue
      ? (isNL ? 'Gemarkeerd als "Bekend om"' : 'Marked as "Known for"')
      : (isNL ? '"Bekend om" verwijderd' : '"Known for" removed'));
    refetch();
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
                {isNL ? 'Bevestig je gerechten' : 'Confirm your dishes'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isNL
                  ? 'Dishloopr stelt gerechten voor op basis van je type keuken. Bevestig wat klopt en geef aan welke dieetopties beschikbaar zijn.'
                  : 'Dishloopr suggests dishes based on your cuisine type. Confirm what\'s correct and indicate available dietary options.'}
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
              {isNL ? 'Bevestig of verwijder deze suggesties' : 'Confirm or remove these suggestions'}
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
                    <span className="font-medium text-sm">{getDishName(item.dish)}</span>
                    {item.dish?.name_en && isNL && (
                      <span className="text-muted-foreground text-xs ml-2">({item.dish.name_en})</span>
                    )}
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(item.confidence_score * 100)}% match
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleConfirm(item.id)}>
                      <Check className="w-4 h-4 mr-1" />
                      {isNL ? 'Bevestig' : 'Confirm'}
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleReject(item.id)}>
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
                ? `Beheer gerechten en markeer max ${SIGNATURE_MAX} als "Bekend om" (${signatureCount}/${SIGNATURE_MAX})`
                : `Manage dishes, mark up to ${SIGNATURE_MAX} as "Known for" (${signatureCount}/${SIGNATURE_MAX})`}
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
            <div className="space-y-4">
              {COURSE_TYPE_ORDER.map(courseType => {
                const courseDishes = confirmedDishes.filter(
                  (d: any) => (d.course_type || 'hoofdgerecht') === courseType
                );
                if (courseDishes.length === 0) return null;
                return (
                  <div key={courseType}>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      {COURSE_TYPE_LABELS[courseType]}
                    </p>
                    <div className="space-y-2">
                       {courseDishes.map((item) => {
                         const isSig = (item as any).is_signature || false;
                         return (
                         <div key={item.id} className={cn(
                           "flex items-center justify-between p-3 rounded-lg border bg-card",
                           isSig && "border-primary/40 bg-primary/5"
                         )}>
                          <div className="flex items-center gap-2 min-w-0">
                            <Select
                              value={(item as any).course_type || 'hoofdgerecht'}
                              onValueChange={async (v) => {
                                await supabase.from('restaurant_dishes').update({ course_type: v }).eq('id', item.id);
                                toast.success('Gangtype bijgewerkt');
                                refetch();
                              }}
                            >
                              <SelectTrigger className="h-7 w-7 p-0 border-0 bg-transparent [&>svg]:hidden shrink-0">
                                <span className="text-xs">
                                  {courseType === 'voorgerecht' ? '🥗' : courseType === 'hoofdgerecht' ? '🍽️' : courseType === 'dessert' ? '🍰' : courseType === 'bijgerecht' ? '🥙' : '🥤'}
                                </span>
                              </SelectTrigger>
                              <SelectContent>
                                {COURSE_TYPE_ORDER.map(ct => (
                                  <SelectItem key={ct} value={ct}>{COURSE_TYPE_LABELS[ct]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {isSig && <Star className="h-3.5 w-3.5 fill-primary text-primary shrink-0" />}
                            <span className="text-sm font-medium truncate">{getDishName(item.dish)}</span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleSignature(item.id, isSig)}
                              disabled={!isSig && signatureCount >= SIGNATURE_MAX}
                              title={isNL ? 'Bekend om' : 'Known for'}
                              className={cn(
                                "p-1 rounded transition-colors",
                                isSig ? "text-primary" : "text-muted-foreground hover:text-primary",
                                !isSig && signatureCount >= SIGNATURE_MAX && "opacity-30 cursor-not-allowed hover:text-muted-foreground"
                              )}
                            >
                              <Star className={cn("h-4 w-4", isSig && "fill-primary")} />
                            </button>
                            {/* Dietary toggles */}
                            <div className="flex items-center gap-1" title="Vegetarisch">
                              <Leaf className="h-3.5 w-3.5 text-green-600" />
                              <Switch
                                checked={(item as any).is_vegetarian || false}
                                onCheckedChange={() => toggleDietaryOption(item.id, 'is_vegetarian', (item as any).is_vegetarian || false)}
                                className="scale-75"
                              />
                            </div>
                            <div className="flex items-center gap-1" title="Glutenvrij">
                              <Wheat className="h-3.5 w-3.5 text-amber-600" />
                              <Switch
                                checked={(item as any).is_gluten_free || false}
                                onCheckedChange={() => toggleDietaryOption(item.id, 'is_gluten_free', (item as any).is_gluten_free || false)}
                                className="scale-75"
                              />
                            </div>
                            <div className="flex items-center gap-1" title="Halal">
                              <span className="text-xs">☪️</span>
                              <Switch
                                checked={(item as any).is_halal || false}
                                onCheckedChange={() => toggleDietaryOption(item.id, 'is_halal', (item as any).is_halal || false)}
                                className="scale-75"
                              />
                            </div>
                            <button
                              onClick={() => deleteDish(item.id)}
                              className="hover:text-destructive transition-colors ml-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                         );
                       })}
                    </div>
                  </div>
                );
              })}
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
            <DialogTitle>{isNL ? 'Gerecht Toevoegen' : 'Add Dish'}</DialogTitle>
          </DialogHeader>

          {!showNewDishForm ? (
            <div className="space-y-4">
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={searchOpen} className="w-full justify-between">
                    {selectedDishId
                      ? getDishName(availableDishes.find((d) => d.id === selectedDishId))
                      : isNL ? 'Selecteer gerecht...' : 'Select dish...'}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder={isNL ? 'Zoek gerecht...' : 'Search dish...'} value={searchQuery} onValueChange={setSearchQuery} />
                    <CommandList>
                      <CommandEmpty>{isNL ? 'Geen gerechten gevonden' : 'No dishes found'}</CommandEmpty>
                      <CommandGroup>
                        {filteredDishes.slice(0, 50).map((dish) => (
                          <CommandItem key={dish.id} value={dish.id} onSelect={() => { setSelectedDishId(dish.id); setSearchOpen(false); }}>
                            <Check className={cn('mr-2 h-4 w-4', selectedDishId === dish.id ? 'opacity-100' : 'opacity-0')} />
                            <div>
                              <div className="text-sm">{getDishName(dish)}</div>
                              {dish.name_en && isNL && <div className="text-xs text-muted-foreground">{dish.name_en}</div>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button variant="ghost" className="w-full text-primary" onClick={() => setShowNewDishForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {isNL ? 'Nieuw gerecht aanmaken' : 'Create new dish'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{isNL ? 'Gerechtnaam (NL)' : 'Dish name (NL)'} *</Label>
                <Input value={newDishName} onChange={(e) => setNewDishName(e.target.value)} placeholder={isNL ? 'Bijv. Rendang' : 'E.g. Rendang'} maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label>{isNL ? 'Engelse naam (optioneel)' : 'English name (optional)'}</Label>
                <Input value={newDishNameEn} onChange={(e) => setNewDishNameEn(e.target.value)} placeholder={isNL ? 'Bijv. Rendang' : 'E.g. Rendang'} maxLength={200} />
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowNewDishForm(false)}>
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
