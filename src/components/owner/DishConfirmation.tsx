import { useEffect, useState } from 'react';
import { useRestaurantDishes, RestaurantDish, Dish } from '@/hooks/useRestaurantDishes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Plus, Loader2, ChefHat, AlertCircle, Search, Leaf, Wheat, Star, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn, formatDishName } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { COURSE_TYPE_LABELS, COURSE_TYPE_ORDER, type CourseType } from '@/hooks/useMenuItems';
import { useOwnerTier } from '@/hooks/useOwnerTier';

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
    searchDishes,
    loading,
    verifyDish,
    rejectDish,
    addOwnerDish,
    deleteDish,
    refetch,
  } = useRestaurantDishes({ restaurantId });

  const [addDishOpen, setAddDishOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [showNewDishForm, setShowNewDishForm] = useState(false);
  const [newDishName, setNewDishName] = useState('');
  const [newDishNameEn, setNewDishNameEn] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);

  const suggestedDishes = dishes.filter((d) => d.status === 'suggested');
  const confirmedDishes = dishes.filter((d) => 
    d.status === 'verified_by_owner' || d.status === 'approved_by_admin'
  );
  const signatureCount = confirmedDishes.filter((d: any) => d.is_signature).length;
  const { data: ownerTier } = useOwnerTier(restaurantId);
  const isPro = ownerTier === 'pro';
  const SIGNATURE_MAX = isPro ? 5 : 1;
  const existingDishIds = dishes.map((d) => d.dish_id);

  // Search in the database as the owner types (debounced).
  useEffect(() => {
    if (!addDishOpen) return;
    const t = setTimeout(() => { void searchDishes(searchQuery); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, addDishOpen]);

  // Results stay in the list after adding (marked "Toegevoegd") so owners can add several in a row.
  const pickList = availableDishes.filter((d) => addedIds.includes(d.id) || !existingDishIds.includes(d.id)).slice(0, 60);
  const quickAdd = async (dishId: string) => {
    setAddingId(dishId);
    const ok = await addOwnerDish(restaurantId, dishId);
    setAddingId(null);
    if (ok) setAddedIds((ids) => [...ids, dishId]);
  };


  const getDishName = (dish: Dish | RestaurantDish['dish']) => {
    // A dish that was deactivated in the catalogue is hidden from owners by RLS, so it arrives empty.
    if (!dish?.name) return isNL ? 'Gerecht niet meer beschikbaar, verwijder het of voeg het opnieuw toe' : 'Dish no longer available';
    const name = isNL ? dish.name : (dish.name_en || dish.name);
    return formatDishName(name);
  };

  const handleConfirm = async (id: string) => {
    await verifyDish(id);
  };

  const handleReject = async (id: string) => {
    await rejectDish(id, 'Afgewezen door eigenaar');
  };

  const handleAutoClassify = async () => {
    if (confirmedDishes.length === 0) return;
    setIsClassifying(true);
    try {
      const dishIds = confirmedDishes.map((d) => d.dish_id).filter(Boolean);
      const { data: dishData, error } = await supabase
        .from('dishes')
        .select('id, is_vegetarian, is_vegan, is_gluten_free, is_halal')
        .in('id', dishIds);
      if (error) throw error;

      const dishMap = new Map((dishData || []).map((d: any) => [d.id, d]));
      let updated = 0;

      await Promise.all(
        confirmedDishes.map(async (item: any) => {
          const ref = dishMap.get(item.dish_id);
          if (!ref) return;
          const patch: Record<string, boolean> = {};
          // Only enable flags; never overwrite an owner's manual toggle to false.
          if ((ref.is_vegetarian || ref.is_vegan) && !item.is_vegetarian) patch.is_vegetarian = true;
          if (ref.is_gluten_free && !item.is_gluten_free) patch.is_gluten_free = true;
          if (ref.is_halal && !item.is_halal) patch.is_halal = true;
          if (Object.keys(patch).length === 0) return;
          const { error: upErr } = await supabase
            .from('restaurant_dishes')
            .update(patch as never)
            .eq('id', item.id);
          if (!upErr) updated += 1;
        }),
      );

      toast.success(
        updated > 0
          ? (isNL ? `${updated} gerechten automatisch geclassificeerd` : `${updated} dishes auto-classified`)
          : (isNL ? 'Alles was al up-to-date' : 'Everything was already up to date'),
      );
      refetch();
    } catch {
      toast.error(isNL ? 'Auto-classificatie mislukt' : 'Auto-classification failed');
    } finally {
      setIsClassifying(false);
    }
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

      let dishId = newDish?.id as string | undefined;
      if (error?.code === '23505') {
        // The dish already exists in Dishloopr (it just was not in the list): use that one,
        // or the main dish when it is an alias. Only a dish already on this menu is refused.
        const bySlug = await supabase.from('dishes')
          .select('id, slug, canonical_slug').eq('slug', slug).maybeSingle();
        const existing = bySlug.data ?? (await supabase.from('dishes')
          .select('id, slug, canonical_slug').ilike('name', newDishName.trim()).limit(1).maybeSingle()).data;
        dishId = existing?.id;
        if (existing?.canonical_slug && existing.canonical_slug !== existing.slug) {
          const { data: main } = await supabase.from('dishes').select('id').eq('slug', existing.canonical_slug).maybeSingle();
          dishId = main?.id ?? dishId;
        }
        if (dishId && dishes.some((d) => d.dish_id === dishId && (d.status === 'verified_by_owner' || d.status === 'approved_by_admin'))) {
          toast.info(isNL ? 'Dit gerecht staat al op je kaart' : 'This dish is already on your menu');
          return;
        }
      } else if (error) {
        toast.error(isNL ? 'Kon gerecht niet aanmaken' : 'Could not create dish');
        return;
      }
      if (!dishId) {
        toast.error(isNL ? 'Dit gerecht bestaat al maar is niet beschikbaar. Mail info@dishloopr.com, dan zetten wij het erbij.' : 'This dish exists but is not available. Email info@dishloopr.com.');
        return;
      }

      const ok = await addOwnerDish(restaurantId, dishId);
      if (ok) setAddedIds((ids) => [...ids, dishId as string]);
      setNewDishName('');
      setNewDishNameEn('');
      setShowNewDishForm(false);
    } catch {
      toast.error(isNL ? 'Er ging iets mis' : 'Something went wrong');
    } finally {
      setIsCreating(false);
    }
  };



  const toggleDietaryOption = async (dishId: string, field: string, currentValue: boolean) => {
    const { error } = await supabase
      .from('restaurant_dishes')
      .update({ [field]: !currentValue } as never)
      .eq('id', dishId);

    if (error) {
      toast.error('Kon niet bijwerken');
      return;
    }
    toast.success('Bijgewerkt');
    refetch();
  };

  // Tag-based dietary flags (dietary_tags text[]).
  // Used for options that don't have a dedicated boolean column
  // (currently: 'vegan', 'lactose-free'). Owners toggle these to
  // add/remove a tag on the restaurant_dishes row.
  const toggleDietaryTag = async (
    dishId: string,
    tag: string,
    currentTags: string[] | null | undefined,
  ) => {
    const has = (currentTags || []).includes(tag);
    const next = has
      ? (currentTags || []).filter((t) => t !== tag)
      : [...(currentTags || []), tag];
    const { error } = await supabase
      .from('restaurant_dishes')
      .update({ dietary_tags: next })
      .eq('id', dishId);
    if (error) {
      toast.error(isNL ? 'Kon niet bijwerken' : 'Could not update');
      return;
    }
    toast.success(isNL ? 'Bijgewerkt' : 'Updated');
    refetch();
  };

  const toggleSignature = async (dishId: string, currentValue: boolean) => {
    if (!currentValue && signatureCount >= SIGNATURE_MAX) {
      toast.error(isNL
        ? (isPro
          ? `Maximaal ${SIGNATURE_MAX} "Bekend om" gerechten`
          : `Gratis plan: 1 "Bekend om"-gerecht. Upgrade naar Pro voor tot ${5}.`)
        : (isPro
          ? `Maximum ${SIGNATURE_MAX} "Known for" dishes`
          : `Free plan: 1 "Known for" dish. Upgrade to Pro for up to ${5}.`));
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
                ? `Beheer gerechten en markeer max ${SIGNATURE_MAX} als "Bekend om" (${signatureCount}/${SIGNATURE_MAX})${!isPro ? ' — Pro: tot 5' : ''}`
                : `Manage dishes, mark up to ${SIGNATURE_MAX} as "Known for" (${signatureCount}/${SIGNATURE_MAX})${!isPro ? ' — Pro: up to 5' : ''}`}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleAutoClassify}
              disabled={isClassifying || confirmedDishes.length === 0}
              title={isNL
                ? 'Vul vegetarisch / glutenvrij / halal automatisch in op basis van het gerecht'
                : 'Auto-fill vegetarian / gluten-free / halal based on the dish'}
            >
              {isClassifying
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <Sparkles className="w-4 h-4 mr-2" />}
              {isNL ? 'Auto-classificeren' : 'Auto-classify'}
            </Button>
            <Button onClick={() => setAddDishOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              {isNL ? 'Gerecht Toevoegen' : 'Add Dish'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          {confirmedDishes.length > 0 && (
            <div className="mb-4 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                {isNL ? 'Legenda' : 'Legend'}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span>🥗</span>{isNL ? 'Voorgerecht' : 'Starter'}</span>
                <span className="inline-flex items-center gap-1.5"><span>🍽️</span>{isNL ? 'Hoofdgerecht' : 'Main'}</span>
                <span className="inline-flex items-center gap-1.5"><span>🍰</span>{isNL ? 'Dessert' : 'Dessert'}</span>
                <span className="inline-flex items-center gap-1.5"><span>🥙</span>{isNL ? 'Bijgerecht' : 'Side'}</span>
                <span className="inline-flex items-center gap-1.5"><span>🥤</span>{isNL ? 'Drank' : 'Drink'}</span>
                <span className="inline-flex items-center gap-1.5"><Star className="h-3.5 w-3.5 fill-primary text-primary" />{isNL ? 'Bekend om' : 'Known for'}</span>
                <span className="inline-flex items-center gap-1.5"><Leaf className="h-3.5 w-3.5 text-green-600" />{isNL ? 'Vegetarisch' : 'Vegetarian'}</span>
                <span className="inline-flex items-center gap-1.5"><Wheat className="h-3.5 w-3.5 text-amber-600" />{isNL ? 'Glutenvrij' : 'Gluten-free'}</span>
                <span className="inline-flex items-center gap-1.5"><span>☪️</span>Halal</span>
                <span className="inline-flex items-center gap-1.5"><X className="h-3.5 w-3.5" />{isNL ? 'Verwijderen' : 'Remove'}</span>
              </div>
            </div>
          )}

          {confirmedDishes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{isNL ? 'Nog geen bevestigde gerechten' : 'No confirmed dishes yet'}</p>
              <p className="mt-1 text-sm">
                {isNL
                  ? 'Voeg je gerechten toe met "Gerecht Toevoegen" of upload je menukaart. Wat je zelf toevoegt, is meteen bevestigd.'
                  : 'Add your dishes with "Add Dish" or upload your menu. Dishes you add yourself are confirmed right away.'}
              </p>
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
                                  {courseType === 'voorgerecht' ? '🥗' : courseType === 'hoofdgerecht' ? '🍽️' : courseType === 'nagerecht' ? '🍰' : courseType === 'bijgerecht' ? '🥙' : courseType === 'borrel' ? '🍢' : '🥤'}
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
                            <div className="flex items-center gap-1" title={isNL ? 'Veganistisch' : 'Vegan'}>
                              <span className="text-xs">🌱</span>
                              <Switch
                                checked={((item as any).dietary_tags || []).includes('vegan')}
                                onCheckedChange={() => toggleDietaryTag(item.id, 'vegan', (item as any).dietary_tags)}
                                className="scale-75"
                              />
                            </div>
                            <div className="flex items-center gap-1" title={isNL ? 'Lactosevrij' : 'Lactose-free'}>
                              <span className="text-xs">🥛</span>
                              <Switch
                                checked={((item as any).dietary_tags || []).includes('lactose-free')}
                                onCheckedChange={() => toggleDietaryTag(item.id, 'lactose-free', (item as any).dietary_tags)}
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
        if (!open) { setShowNewDishForm(false); setNewDishName(''); setNewDishNameEn(''); setSearchQuery(''); setAddedIds([]); }
      }}>
        <DialogContent className="flex h-[85vh] max-w-3xl flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isNL ? 'Gerechten toevoegen' : 'Add dishes'}</DialogTitle>
            <DialogDescription>
              {isNL
                ? 'Zoek een gerecht en klik op Toevoegen. Je kunt er meerdere achter elkaar toevoegen; wat je toevoegt is meteen bevestigd.'
                : 'Search a dish and click Add. You can add several in a row; dishes you add are confirmed right away.'}
            </DialogDescription>
          </DialogHeader>

          {!showNewDishForm ? (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isNL ? 'Zoek gerecht, bijvoorbeeld rendang' : 'Search dish, e.g. rendang'}
                  className="h-11 pl-9 text-base" aria-label={isNL ? 'Zoek gerecht' : 'Search dish'} />
              </div>
              <div className="min-h-0 flex-1 divide-y overflow-y-auto rounded-md border" role="list">
                {pickList.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    {isNL ? 'Geen gerechten gevonden.' : 'No dishes found.'}
                  </div>
                ) : pickList.map((dish) => {
                  const added = addedIds.includes(dish.id);
                  return (
                    <div key={dish.id} role="listitem" className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{getDishName(dish)}</div>
                        {dish.name_en && isNL && <div className="truncate text-xs text-muted-foreground">{dish.name_en}</div>}
                      </div>
                      {added ? (
                        <span className="flex shrink-0 items-center gap-1 text-sm text-primary"><Check className="h-4 w-4" />{isNL ? 'Toegevoegd' : 'Added'}</span>
                      ) : (
                        <Button size="sm" variant="outline" className="min-h-9 shrink-0" disabled={addingId === dish.id} onClick={() => quickAdd(dish.id)}>
                          {addingId === dish.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" />{isNL ? 'Toevoegen' : 'Add'}</>}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button variant="ghost" className="text-primary" onClick={() => { setNewDishName(searchQuery.trim()); setShowNewDishForm(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                {isNL ? 'Staat je gerecht er niet tussen? Nieuw gerecht aanmaken' : 'Not in the list? Create a new dish'}
              </Button>
            </>
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

          <DialogFooter className="items-center gap-2 sm:justify-between">
            <span className="text-sm text-muted-foreground">
              {addedIds.length > 0 ? (isNL ? `${addedIds.length} toegevoegd` : `${addedIds.length} added`) : ''}
            </span>
            {showNewDishForm ? (
              <Button onClick={handleCreateAndAddDish} disabled={!newDishName.trim() || isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isNL ? 'Aanmaken & Toevoegen' : 'Create & Add'}
              </Button>
            ) : (
              <Button onClick={() => setAddDishOpen(false)}>{isNL ? 'Klaar' : 'Done'}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
