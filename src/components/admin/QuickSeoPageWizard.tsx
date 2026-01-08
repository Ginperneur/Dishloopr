import { useState, useEffect } from 'react';
import {
  Wand2,
  ChevronRight,
  ChevronLeft,
  Plus,
  Check,
  Search,
  Building2,
  Globe,
  Sparkles,
  Loader2,
  X,
  MapPin,
  Star
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  address: string;
  rating: number;
  review_count: number;
  images: string[] | null;
}

interface QuickSeoPageWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function QuickSeoPageWizard({ open, onOpenChange, onSuccess }: QuickSeoPageWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Dish & City selection
  const [dishes, setDishes] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [cities, setCities] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [selectedDish, setSelectedDish] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [newDishName, setNewDishName] = useState('');
  const [showNewDish, setShowNewDish] = useState(false);
  
  // Step 2: Restaurant selection
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);
  const [restaurantSearch, setRestaurantSearch] = useState('');
  const [newRestaurantName, setNewRestaurantName] = useState('');
  const [showNewRestaurant, setShowNewRestaurant] = useState(false);
  const [loadingRestaurants, setLoadingRestaurants] = useState(false);
  
  // Step 3: SEO content
  const [slug, setSlug] = useState('');
  const [h1Title, setH1Title] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [introText, setIntroText] = useState('');
  const [generateFaq, setGenerateFaq] = useState(true);
  
  // Fetch dishes and cities
  useEffect(() => {
    if (!open) return;
    
    async function fetchOptions() {
      const [dishesRes, citiesRes] = await Promise.all([
        supabase.from('dishes').select('id, name, slug').eq('is_active', true).order('name'),
        supabase.from('cities').select('id, name, slug').eq('is_active', true).order('name'),
      ]);
      if (dishesRes.data) setDishes(dishesRes.data);
      if (citiesRes.data) setCities(citiesRes.data);
    }
    fetchOptions();
  }, [open]);
  
  // Fetch restaurants when dish + city selected
  useEffect(() => {
    if (!selectedCity) return;
    
    async function fetchRestaurants() {
      setLoadingRestaurants(true);
      const { data } = await supabase
        .from('restaurants')
        .select('id, name, slug, address, rating, review_count, images')
        .eq('city_id', selectedCity)
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(50);
      
      setRestaurants(data || []);
      setLoadingRestaurants(false);
    }
    fetchRestaurants();
  }, [selectedCity]);
  
  // Auto-generate content when dish/city change
  useEffect(() => {
    const dish = dishes.find(d => d.id === selectedDish);
    const city = cities.find(c => c.id === selectedCity);
    
    if (dish && city) {
      setSlug(`${dish.slug}-${city.slug}`);
      setH1Title(`Beste ${dish.name} in ${city.name}`);
      setMetaTitle(`${dish.name} ${city.name} | Beste Restaurants | Dishloopr`);
      setMetaDescription(`Ontdek de lekkerste ${dish.name.toLowerCase()} restaurants in ${city.name}. Vergelijk reviews, prijzen en sfeer.`);
      setIntroText(`Op zoek naar de beste ${dish.name.toLowerCase()} in ${city.name}? Wij hebben de top restaurants voor je verzameld.`);
    }
  }, [selectedDish, selectedCity, dishes, cities]);
  
  const filteredRestaurants = restaurants.filter(r =>
    r.name.toLowerCase().includes(restaurantSearch.toLowerCase())
  );
  
  const toggleRestaurant = (id: string) => {
    setSelectedRestaurants(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };
  
  const handleAddNewDish = async () => {
    if (!newDishName.trim()) return;
    
    const dishSlug = newDishName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    const { data, error } = await supabase
      .from('dishes')
      .insert([{ name: newDishName, slug: dishSlug }])
      .select()
      .single();
    
    if (error) {
      toast.error('Fout bij toevoegen gerecht');
      return;
    }
    
    setDishes(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedDish(data.id);
    setNewDishName('');
    setShowNewDish(false);
    toast.success('Gerecht toegevoegd');
  };
  
  const handleAddNewRestaurant = async () => {
    if (!newRestaurantName.trim() || !selectedCity) return;
    
    const restaurantSlug = newRestaurantName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    const { data, error } = await supabase
      .from('restaurants')
      .insert([{
        name: newRestaurantName,
        slug: restaurantSlug,
        city_id: selectedCity,
        address: '',
        price_level: 2
      }])
      .select()
      .single();
    
    if (error) {
      toast.error('Fout bij toevoegen restaurant');
      return;
    }
    
    setRestaurants(prev => [data, ...prev]);
    setSelectedRestaurants(prev => [...prev, data.id]);
    setNewRestaurantName('');
    setShowNewRestaurant(false);
    toast.success('Restaurant toegevoegd');
  };
  
  const handleCreate = async () => {
    if (!selectedDish || !selectedCity || !slug || !h1Title) {
      toast.error('Vul alle verplichte velden in');
      return;
    }
    
    setLoading(true);
    
    try {
      // 1. Create SEO landing page
      const { data: seoPage, error: seoError } = await supabase
        .from('seo_landing_pages')
        .insert([{
          slug,
          dish_id: selectedDish,
          city_id: selectedCity,
          meta_title: metaTitle,
          meta_description: metaDescription,
          h1_title: h1Title,
          intro_text: introText,
          is_active: true,
          is_auto_generated: false
        }])
        .select()
        .single();
      
      if (seoError) throw seoError;
      
      // 2. Link selected restaurants to dish
      if (selectedRestaurants.length > 0) {
        // First check existing links
        const { data: existingLinks } = await supabase
          .from('restaurant_dishes')
          .select('restaurant_id')
          .eq('dish_id', selectedDish)
          .in('restaurant_id', selectedRestaurants);
        
        const existingIds = new Set(existingLinks?.map(l => l.restaurant_id) || []);
        const newLinks = selectedRestaurants.filter(id => !existingIds.has(id));
        
        if (newLinks.length > 0) {
          const { error: linkError } = await supabase
            .from('restaurant_dishes')
            .insert(newLinks.map(restaurantId => ({
              restaurant_id: restaurantId,
              dish_id: selectedDish,
              confidence_score: 100
            })));
          
          if (linkError) throw linkError;
        }
      }
      
      // 3. Generate FAQ if enabled
      if (generateFaq && seoPage) {
        const dish = dishes.find(d => d.id === selectedDish);
        const city = cities.find(c => c.id === selectedCity);
        
        if (dish && city) {
          supabase.functions.invoke('generate-seo-faq', {
            body: { pageId: seoPage.id, dishName: dish.name, cityName: city.name }
          }).then(() => {
            toast.success('FAQ\'s worden gegenereerd...');
          });
        }
      }
      
      toast.success('SEO pagina aangemaakt!');
      onSuccess();
      handleClose();
      
    } catch (error) {
      console.error('Create error:', error);
      toast.error('Fout bij aanmaken pagina');
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = () => {
    setStep(1);
    setSelectedDish('');
    setSelectedCity('');
    setSelectedRestaurants([]);
    setRestaurantSearch('');
    setNewDishName('');
    setNewRestaurantName('');
    setShowNewDish(false);
    setShowNewRestaurant(false);
    setSlug('');
    setH1Title('');
    setMetaTitle('');
    setMetaDescription('');
    setIntroText('');
    setGenerateFaq(true);
    onOpenChange(false);
  };
  
  const canProceedStep1 = selectedDish && selectedCity;
  const canProceedStep2 = true; // Restaurants are optional
  const canCreate = slug && h1Title && metaTitle;
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Quick SEO Page Wizard
          </DialogTitle>
        </DialogHeader>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === s 
                  ? 'bg-primary text-primary-foreground' 
                  : step > s 
                    ? 'bg-primary/20 text-primary' 
                    : 'bg-muted text-muted-foreground'
              }`}>
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && (
                <div className={`w-16 h-0.5 mx-1 ${step > s ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>
        
        <div className="text-center text-sm text-muted-foreground mb-4">
          {step === 1 && 'Stap 1: Selecteer gerecht en stad'}
          {step === 2 && 'Stap 2: Selecteer restaurants'}
          {step === 3 && 'Stap 3: SEO content instellen'}
        </div>
        
        <ScrollArea className="max-h-[50vh]">
          {/* Step 1: Dish & City */}
          {step === 1 && (
            <div className="space-y-6 p-1">
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Gerecht
                </Label>
                {!showNewDish ? (
                  <div className="space-y-2">
                    <Select value={selectedDish} onValueChange={setSelectedDish}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer een gerecht..." />
                      </SelectTrigger>
                      <SelectContent>
                        {dishes.map(dish => (
                          <SelectItem key={dish.id} value={dish.id}>
                            {dish.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setShowNewDish(true)}
                      className="text-primary"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Nieuw gerecht toevoegen
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={newDishName}
                      onChange={(e) => setNewDishName(e.target.value)}
                      placeholder="Naam nieuw gerecht..."
                      autoFocus
                    />
                    <Button onClick={handleAddNewDish} disabled={!newDishName.trim()}>
                      Toevoegen
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setShowNewDish(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="space-y-3">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Stad
                </Label>
                <Select value={selectedCity} onValueChange={setSelectedCity}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer een stad..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map(city => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedDish && selectedCity && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-sm font-medium text-primary">
                    Pagina preview: /eten/{slug}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {h1Title}
                  </p>
                </div>
              )}
            </div>
          )}
          
          {/* Step 2: Restaurants */}
          {step === 2 && (
            <div className="space-y-4 p-1">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Restaurants koppelen
                </Label>
                <Badge variant="secondary">
                  {selectedRestaurants.length} geselecteerd
                </Badge>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={restaurantSearch}
                  onChange={(e) => setRestaurantSearch(e.target.value)}
                  placeholder="Zoek restaurants..."
                  className="pl-10"
                />
              </div>
              
              {!showNewRestaurant ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowNewRestaurant(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nieuw restaurant toevoegen
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={newRestaurantName}
                    onChange={(e) => setNewRestaurantName(e.target.value)}
                    placeholder="Naam nieuw restaurant..."
                    autoFocus
                  />
                  <Button onClick={handleAddNewRestaurant} disabled={!newRestaurantName.trim()}>
                    Toevoegen
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setShowNewRestaurant(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {loadingRestaurants ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredRestaurants.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Geen restaurants gevonden
                  </p>
                ) : (
                  filteredRestaurants.map(restaurant => (
                    <div
                      key={restaurant.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedRestaurants.includes(restaurant.id)
                          ? 'border-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleRestaurant(restaurant.id)}
                    >
                      <Checkbox
                        checked={selectedRestaurants.includes(restaurant.id)}
                        onCheckedChange={() => toggleRestaurant(restaurant.id)}
                      />
                      <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        {restaurant.images?.[0] ? (
                          <img 
                            src={restaurant.images[0]} 
                            alt={restaurant.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{restaurant.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {restaurant.address || 'Geen adres'}
                        </p>
                      </div>
                      {restaurant.rating > 0 && (
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {restaurant.rating.toFixed(1)}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
          
          {/* Step 3: SEO Content */}
          {step === 3 && (
            <div className="space-y-4 p-1">
              <div>
                <Label>URL Slug *</Label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-muted rounded-l-md border border-r-0 text-sm text-muted-foreground">
                    /eten/
                  </span>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="rounded-l-none"
                  />
                </div>
              </div>
              
              <div>
                <Label>H1 Titel *</Label>
                <Input
                  value={h1Title}
                  onChange={(e) => setH1Title(e.target.value)}
                />
              </div>
              
              <div>
                <Label>Meta Title * (max 60 karakters)</Label>
                <Input
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  maxLength={60}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {metaTitle.length}/60 karakters
                </p>
              </div>
              
              <div>
                <Label>Meta Description (max 160 karakters)</Label>
                <Textarea
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  maxLength={160}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {metaDescription.length}/160 karakters
                </p>
              </div>
              
              <div>
                <Label>Intro Tekst</Label>
                <Textarea
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="flex items-center gap-3 p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <Switch
                  checked={generateFaq}
                  onCheckedChange={setGenerateFaq}
                />
                <div className="flex-1">
                  <Label className="flex items-center gap-2 cursor-pointer">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    Automatisch FAQ's genereren met AI
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Creëert 5-7 SEO-geoptimaliseerde vragen en antwoorden
                  </p>
                </div>
              </div>
              
              {/* Summary */}
              <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
                <h4 className="font-semibold text-sm">Samenvatting</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Gerecht:</span>
                  <span>{dishes.find(d => d.id === selectedDish)?.name}</span>
                  <span className="text-muted-foreground">Stad:</span>
                  <span>{cities.find(c => c.id === selectedCity)?.name}</span>
                  <span className="text-muted-foreground">Restaurants:</span>
                  <span>{selectedRestaurants.length} gekoppeld</span>
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
        
        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Vorige
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              Annuleren
            </Button>
            {step < 3 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !canProceedStep1}
              >
                Volgende
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={loading || !canCreate}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Pagina aanmaken
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
