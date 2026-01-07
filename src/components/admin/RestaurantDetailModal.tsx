import { useState, useEffect } from 'react';
import { 
  Eye, 
  MousePointer, 
  Phone, 
  Globe, 
  Calendar,
  Star,
  MessageSquare,
  MapPin,
  ExternalLink,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Link2,
  Check,
  X,
  Instagram
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TagInput } from '@/components/ui/tag-input';
import { MenuUpload } from '@/components/admin/MenuUpload';
import { RestaurantImageUpload } from '@/components/admin/RestaurantImageUpload';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface RestaurantDetailModalProps {
  restaurant: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

interface Analytics {
  totalViews: number;
  totalClicks: number;
  websiteClicks: number;
  phoneClicks: number;
  reservationClicks: number;
  directionsClicks: number;
  uniqueVisitors: number;
  viewsByDay: { date: string; count: number }[];
}

interface Review {
  id: string;
  rating: number;
  title: string;
  status: string;
  created_at: string;
}

interface Dish {
  id: string;
  name: string;
  slug: string;
  synonyms: string[];
}

export function RestaurantDetailModal({ restaurant, open, onOpenChange, onUpdate }: RestaurantDetailModalProps) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [city, setCity] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [ambienceTags, setAmbienceTags] = useState<string[]>([]);
  const [concepts, setConcepts] = useState<string[]>([]);
  const [mealTypes, setMealTypes] = useState<string[]>([]);
  const [experiences, setExperiences] = useState<string[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [allDishes, setAllDishes] = useState<Dish[]>([]);
  const [newDishName, setNewDishName] = useState('');
  const [zenchefId, setZenchefId] = useState<string>('');
  const [zenchefSaving, setZenchefSaving] = useState(false);
  const [instagramUrl, setInstagramUrl] = useState<string>('');
  const [tiktokUrl, setTiktokUrl] = useState<string>('');
  const [socialSaving, setSocialSaving] = useState(false);

  useEffect(() => {
    if (open && restaurant) {
      fetchData();
      setCuisines(restaurant.cuisines || []);
      setAmbienceTags(restaurant.ambience_tags || []);
      setConcepts(restaurant.concepts || []);
      setMealTypes(restaurant.meal_types || []);
      setExperiences(restaurant.experiences || []);
      setZenchefId(restaurant.zenchef_id || '');
      setInstagramUrl(restaurant.instagram_url || '');
      setTiktokUrl(restaurant.tiktok_url || '');
    }
  }, [open, restaurant]);

  const updateTags = async (field: 'cuisines' | 'ambience_tags' | 'concepts' | 'meal_types' | 'experiences', tags: string[]) => {
    const { error } = await supabase
      .from('restaurants')
      .update({ [field]: tags })
      .eq('id', restaurant.id);

    if (error) {
      toast.error('Tags bijwerken mislukt');
    } else {
      toast.success('Tags bijgewerkt');
      onUpdate?.();
    }
  };

  const handleMealTypesChange = (newMealTypes: string[]) => {
    setMealTypes(newMealTypes);
    updateTags('meal_types', newMealTypes);
  };

  const handleExperiencesChange = (newExperiences: string[]) => {
    setExperiences(newExperiences);
    updateTags('experiences', newExperiences);
  };

  const handleCuisinesChange = (newCuisines: string[]) => {
    setCuisines(newCuisines);
    updateTags('cuisines', newCuisines);
  };

  const handleAmbienceChange = (newAmbience: string[]) => {
    setAmbienceTags(newAmbience);
    updateTags('ambience_tags', newAmbience);
  };

  const handleConceptsChange = (newConcepts: string[]) => {
    setConcepts(newConcepts);
    updateTags('concepts', newConcepts);
  };

  const saveZenchefId = async () => {
    setZenchefSaving(true);
    const { error } = await supabase
      .from('restaurants')
      .update({ zenchef_id: zenchefId || null })
      .eq('id', restaurant.id);

    if (error) {
      toast.error('Zenchef ID opslaan mislukt');
    } else {
      toast.success('Zenchef ID opgeslagen');
      onUpdate?.();
    }
    setZenchefSaving(false);
  };

  const clearZenchefId = async () => {
    setZenchefSaving(true);
    const { error } = await supabase
      .from('restaurants')
      .update({ zenchef_id: null })
      .eq('id', restaurant.id);

    if (error) {
      toast.error('Zenchef ID verwijderen mislukt');
    } else {
      setZenchefId('');
      toast.success('Zenchef ID verwijderd');
      onUpdate?.();
    }
    setZenchefSaving(false);
  };

  const saveSocialLinks = async () => {
    setSocialSaving(true);
    const { error } = await supabase
      .from('restaurants')
      .update({ 
        instagram_url: instagramUrl || null,
        tiktok_url: tiktokUrl || null 
      })
      .eq('id', restaurant.id);

    if (error) {
      toast.error('Social media links opslaan mislukt');
    } else {
      toast.success('Social media links opgeslagen');
      onUpdate?.();
    }
    setSocialSaving(false);
  };

  const fetchData = async () => {
    setLoading(true);

    // Fetch city
    if (restaurant.city_id) {
      const { data: cityData } = await supabase
        .from('cities')
        .select('name')
        .eq('id', restaurant.city_id)
        .maybeSingle();
      setCity(cityData);
    }

    // Fetch reviews
    const { data: reviewData } = await supabase
      .from('reviews')
      .select('id, rating, title, status, created_at')
      .eq('restaurant_id', restaurant.id)
      .order('created_at', { ascending: false });
    setReviews(reviewData || []);

    // Fetch all dishes for selection
    const { data: allDishesData } = await supabase
      .from('dishes')
      .select('id, name, slug, synonyms')
      .eq('is_active', true)
      .order('name');
    setAllDishes(allDishesData || []);

    // Fetch linked dishes
    const { data: linkedDishes } = await supabase
      .from('restaurant_dishes')
      .select('dish_id')
      .eq('restaurant_id', restaurant.id);

    if (linkedDishes && linkedDishes.length > 0) {
      const dishIds = linkedDishes.map(ld => ld.dish_id);
      const { data: dishData } = await supabase
        .from('dishes')
        .select('id, name, slug, synonyms')
        .in('id', dishIds);
      setDishes(dishData || []);
    } else {
      setDishes([]);
    }

    // Fetch analytics (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: analyticsData } = await supabase
      .from('analytics_events')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (analyticsData) {
      const viewsByDay: { [date: string]: number } = {};
      const uniqueSessions = new Set<string>();
      let totalViews = 0;
      let totalClicks = 0;
      let websiteClicks = 0;
      let phoneClicks = 0;
      let reservationClicks = 0;
      let directionsClicks = 0;

      analyticsData.forEach(event => {
        const date = event.created_at.split('T')[0];
        if (event.session_id) uniqueSessions.add(event.session_id);
        
        if (event.event_type === 'view') {
          totalViews++;
          viewsByDay[date] = (viewsByDay[date] || 0) + 1;
        } else if (event.event_type === 'click') {
          totalClicks++;
          const metadata = event.metadata as { type?: string } | null;
          if (metadata?.type === 'website') websiteClicks++;
          if (metadata?.type === 'phone') phoneClicks++;
          if (metadata?.type === 'reservation') reservationClicks++;
          if (metadata?.type === 'directions') directionsClicks++;
        }
      });

      setAnalytics({
        totalViews,
        totalClicks,
        websiteClicks,
        phoneClicks,
        reservationClicks,
        directionsClicks,
        uniqueVisitors: uniqueSessions.size,
        viewsByDay: Object.entries(viewsByDay)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date))
      });
    } else {
      setAnalytics({
        totalViews: 0,
        totalClicks: 0,
        websiteClicks: 0,
        phoneClicks: 0,
        reservationClicks: 0,
        directionsClicks: 0,
        uniqueVisitors: 0,
        viewsByDay: []
      });
    }

    setLoading(false);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const addDishes = async (dishNames: string[]) => {
    for (const name of dishNames) {
      const trimmedName = name.trim();
      if (!trimmedName) continue;

      // Check if dish already exists
      let dish = allDishes.find(d => d.name.toLowerCase() === trimmedName.toLowerCase());

      if (!dish) {
        // Create new dish
        const { data: newDish, error: dishError } = await supabase
          .from('dishes')
          .insert({
            name: trimmedName,
            slug: generateSlug(trimmedName),
            synonyms: [],
            is_active: true
          })
          .select()
          .single();

        if (dishError) {
          toast.error(`Gerecht "${trimmedName}" toevoegen mislukt`);
          continue;
        }
        dish = newDish;
        setAllDishes(prev => [...prev, newDish]);
      }

      // Check if already linked
      const alreadyLinked = dishes.some(d => d.id === dish!.id);
      if (alreadyLinked) continue;

      // Link dish to restaurant
      const { error: linkError } = await supabase
        .from('restaurant_dishes')
        .insert({
          restaurant_id: restaurant.id,
          dish_id: dish!.id,
          confidence_score: 1.0
        });

      if (linkError) {
        toast.error(`Koppelen van "${trimmedName}" mislukt`);
      } else {
        setDishes(prev => [...prev, dish!]);
      }
    }
    toast.success('Gerechten bijgewerkt');
    onUpdate?.();
  };

  const removeDish = async (dishId: string) => {
    const { error } = await supabase
      .from('restaurant_dishes')
      .delete()
      .eq('restaurant_id', restaurant.id)
      .eq('dish_id', dishId);

    if (error) {
      toast.error('Gerecht verwijderen mislukt');
    } else {
      setDishes(prev => prev.filter(d => d.id !== dishId));
      toast.success('Gerecht verwijderd');
      onUpdate?.();
    }
  };

  const updateDishSynonyms = async (dishId: string, synonyms: string[]) => {
    const { error } = await supabase
      .from('dishes')
      .update({ synonyms })
      .eq('id', dishId);

    if (error) {
      toast.error('Synoniemen bijwerken mislukt');
    } else {
      setDishes(prev => prev.map(d => d.id === dishId ? { ...d, synonyms } : d));
      setAllDishes(prev => prev.map(d => d.id === dishId ? { ...d, synonyms } : d));
      toast.success('Synoniemen bijgewerkt');
    }
  };

  if (!restaurant) return null;

  const conversionRate = analytics && analytics.totalViews > 0 
    ? ((analytics.totalClicks / analytics.totalViews) * 100).toFixed(1) 
    : '0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="text-xl">{restaurant.name}</span>
            <div className="flex gap-2">
              {restaurant.is_featured && (
                <Badge className="bg-amber-500">Featured</Badge>
              )}
              {restaurant.is_top_listing && (
                <Badge className="bg-purple-500">Top Listing</Badge>
              )}
              <Badge variant={restaurant.is_active ? 'default' : 'secondary'}>
                {restaurant.is_active ? 'Actief' : 'Inactief'}
              </Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-24 bg-muted rounded-lg" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted rounded" />)}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Restaurant Info */}
            <Card>
              <CardContent className="p-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{restaurant.address}, {restaurant.postal_code}</span>
                    </div>
                    {city && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{city.name}</Badge>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 fill-rating text-rating" />
                      <span className="font-semibold">{Number(restaurant.rating).toFixed(1)}</span>
                      <span className="text-muted-foreground">({restaurant.review_count} reviews)</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/restaurant/${restaurant.slug}`} target="_blank">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Bekijk pagina
                      </Link>
                    </Button>
                    {restaurant.website_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={restaurant.website_url} target="_blank" rel="noopener noreferrer">
                          <Globe className="h-4 w-4 mr-2" />
                          Website
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Restaurant Images */}
            <RestaurantImageUpload
              restaurantId={restaurant.id}
              restaurantName={restaurant.name}
              existingImages={restaurant.images || []}
              onImagesUpdate={(images) => {
                restaurant.images = images;
                onUpdate?.();
              }}
            />

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Eye className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                  <p className="text-2xl font-bold">{analytics?.totalViews || 0}</p>
                  <p className="text-sm text-muted-foreground">Weergaven</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-6 w-6 mx-auto text-green-500 mb-2" />
                  <p className="text-2xl font-bold">{analytics?.uniqueVisitors || 0}</p>
                  <p className="text-sm text-muted-foreground">Unieke bezoekers</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <MousePointer className="h-6 w-6 mx-auto text-orange-500 mb-2" />
                  <p className="text-2xl font-bold">{analytics?.totalClicks || 0}</p>
                  <p className="text-sm text-muted-foreground">Totale clicks</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 mx-auto text-purple-500 mb-2" />
                  <p className="text-2xl font-bold">{conversionRate}%</p>
                  <p className="text-sm text-muted-foreground">Conversie</p>
                </CardContent>
              </Card>
            </div>

            {/* CTA Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">CTA Clicks (laatste 30 dagen)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <Globe className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-semibold">{analytics?.websiteClicks || 0}</p>
                      <p className="text-xs text-muted-foreground">Website</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <Phone className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-semibold">{analytics?.phoneClicks || 0}</p>
                      <p className="text-xs text-muted-foreground">Telefoon</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <Calendar className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="font-semibold">{analytics?.reservationClicks || 0}</p>
                      <p className="text-xs text-muted-foreground">Reserveringen</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <MapPin className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="font-semibold">{analytics?.directionsClicks || 0}</p>
                      <p className="text-xs text-muted-foreground">Route</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Views Chart */}
            {analytics && analytics.viewsByDay.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Weergaven per dag</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-32 flex items-end gap-1">
                    {analytics.viewsByDay.map((day) => {
                      const maxCount = Math.max(...analytics.viewsByDay.map(d => d.count));
                      const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                      return (
                        <div
                          key={day.date}
                          className="flex-1 bg-primary/80 hover:bg-primary transition-colors rounded-t cursor-help"
                          style={{ height: `${Math.max(height, 5)}%` }}
                          title={`${day.date}: ${day.count} weergaven`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>{analytics.viewsByDay[0]?.date}</span>
                    <span>{analytics.viewsByDay[analytics.viewsByDay.length - 1]?.date}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Separator />

            {/* Dishes Management */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5" />
                  Gerechten ({dishes.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {dishes.map((dish) => (
                    <div key={dish.id} className="group relative">
                      <Badge variant="default" className="pr-6 capitalize">
                        {dish.name}
                        <button
                          onClick={() => removeDish(dish.id)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 hover:text-destructive"
                        >
                          ×
                        </button>
                      </Badge>
                      {dish.synonyms && dish.synonyms.length > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          ({dish.synonyms.slice(0, 2).join(', ')})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Gerechten toevoegen</p>
                  <TagInput
                    tags={[]}
                    onTagsChange={(tags) => {
                      if (tags.length > 0) {
                        addDishes(tags);
                      }
                    }}
                    placeholder="ossenhaas, spaghetti, nachos..."
                    variant="default"
                  />
                </div>

                {dishes.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Synoniemen beheren</p>
                    <div className="space-y-3">
                      {dishes.map((dish) => (
                        <div key={dish.id} className="p-3 rounded-lg bg-muted/50">
                          <p className="text-sm font-medium capitalize mb-2">{dish.name}</p>
                          <TagInput
                            tags={dish.synonyms || []}
                            onTagsChange={(newSynonyms) => updateDishSynonyms(dish.id, newSynonyms)}
                            placeholder="steak, biefstuk, entrecote..."
                            variant="secondary"
                          />
                        </div>
                      ))}
                    </div>
                </div>
                )}

                {/* Menu PDF Upload */}
                <Separator className="my-4" />
                <MenuUpload 
                  restaurantId={restaurant.id} 
                  restaurantName={restaurant.name}
                  onSuccess={fetchData}
                />
              </CardContent>
            </Card>

            {/* Reviews Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Reviews ({reviews.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reviews.length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center p-3 rounded-lg bg-green-500/10">
                        <p className="text-xl font-bold text-green-600">
                          {reviews.filter(r => r.status === 'published').length}
                        </p>
                        <p className="text-xs text-muted-foreground">Gepubliceerd</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-yellow-500/10">
                        <p className="text-xl font-bold text-yellow-600">
                          {reviews.filter(r => r.status === 'pending').length}
                        </p>
                        <p className="text-xs text-muted-foreground">In afwachting</p>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-red-500/10">
                        <p className="text-xl font-bold text-red-600">
                          {reviews.filter(r => r.status === 'flagged').length}
                        </p>
                        <p className="text-xs text-muted-foreground">Gemarkeerd</p>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {reviews.slice(0, 5).map(review => (
                        <div key={review.id} className="flex items-center justify-between p-2 rounded bg-muted">
                          <div className="flex items-center gap-2">
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 ${
                                    i < review.rating ? 'fill-rating text-rating' : 'text-muted-foreground'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-sm truncate max-w-48">{review.title || '(Geen titel)'}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {review.status === 'published' ? 'Gepubliceerd' : 
                             review.status === 'pending' ? 'Wachtend' : 'Gemarkeerd'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    Nog geen reviews ontvangen
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Restaurant Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Aangemaakt</p>
                    <p className="font-medium">
                      {new Date(restaurant.created_at).toLocaleDateString('nl-NL', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Laatst bijgewerkt</p>
                    <p className="font-medium">
                      {new Date(restaurant.updated_at).toLocaleDateString('nl-NL', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Prijsniveau</p>
                    <p className="font-medium">{'€'.repeat(restaurant.price_level)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Geclaimd</p>
                    <p className="font-medium">{restaurant.claimed_by_owner_id ? 'Ja' : 'Nee'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Booking Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Reservering Integratie
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Zenchef Integration */}
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      <span className="font-medium">Zenchef Widget</span>
                    </div>
                    {restaurant.zenchef_id ? (
                      <Badge className="bg-green-500/10 text-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Gekoppeld
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Niet gekoppeld
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={zenchefId}
                      onChange={(e) => setZenchefId(e.target.value)}
                      placeholder="Zenchef Restaurant ID (bijv. 375166)"
                      className="flex-1 px-3 py-2 text-sm rounded-md border border-input bg-background"
                    />
                    <Button 
                      size="sm" 
                      onClick={saveZenchefId}
                      disabled={zenchefSaving}
                    >
                      {zenchefSaving ? 'Opslaan...' : 'Opslaan'}
                    </Button>
                    {restaurant.zenchef_id && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={clearZenchefId}
                        disabled={zenchefSaving}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-2">
                    Vind je Zenchef ID op{' '}
                    <a 
                      href="https://sdk.zenchef.com/configure.html" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      sdk.zenchef.com
                    </a>
                  </p>

                  {restaurant.zenchef_id && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <Button variant="outline" size="sm" asChild>
                        <a 
                          href={`https://widget.zenchef.com/reservation/${restaurant.zenchef_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3 mr-2" />
                          Test Widget
                        </a>
                      </Button>
                    </div>
                  )}
                </div>

                {/* Fallback URL */}
                <div className="p-4 rounded-lg border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Fallback Reserverings URL</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Wordt gebruikt als Zenchef niet gekoppeld is (bijv. TheFork, OpenTable)
                  </p>
                  <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                    {restaurant.reservation_url || 'Niet ingesteld'}
                  </code>
                </div>
              </CardContent>
            </Card>

            {/* Social Media Links */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Instagram className="h-5 w-5" />
                  Social Media
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Instagram URL</p>
                  <input
                    type="url"
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    placeholder="https://instagram.com/restaurantnaam"
                    className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">TikTok URL</p>
                  <input
                    type="url"
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    placeholder="https://tiktok.com/@restaurantnaam"
                    className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background"
                  />
                </div>
                <Button 
                  onClick={saveSocialLinks}
                  disabled={socialSaving}
                  className="w-full"
                >
                  {socialSaving ? 'Opslaan...' : 'Social links opslaan'}
                </Button>
              </CardContent>
            </Card>

            {/* Tag Management */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tags beheren</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Cuisines */}
                <div>
                  <p className="text-sm font-medium mb-2">Keukens</p>
                  <TagInput
                    tags={cuisines}
                    onTagsChange={handleCuisinesChange}
                    placeholder="italiaans, japans, mexicaans..."
                    variant="outline"
                  />
                </div>

                {/* Ambience Tags */}
                <div>
                  <p className="text-sm font-medium mb-2">Sfeer</p>
                  <TagInput
                    tags={ambienceTags}
                    onTagsChange={handleAmbienceChange}
                    placeholder="romantisch, gezellig, zakelijk..."
                    variant="secondary"
                  />
                </div>

                {/* Concepts */}
                <div>
                  <p className="text-sm font-medium mb-2">Concepten</p>
                  <TagInput
                    tags={concepts}
                    onTagsChange={handleConceptsChange}
                    placeholder="shared dining, all you can eat, tasting menu..."
                    variant="outline"
                  />
                </div>

                {/* Meal Types */}
                <div>
                  <p className="text-sm font-medium mb-2">Maaltijdtypes</p>
                  <TagInput
                    tags={mealTypes}
                    onTagsChange={handleMealTypesChange}
                    placeholder="breakfast, brunch, lunch, dinner..."
                    variant="secondary"
                  />
                </div>

                {/* Experiences */}
                <div>
                  <p className="text-sm font-medium mb-2">Ervaringen</p>
                  <TagInput
                    tags={experiences}
                    onTagsChange={handleExperiencesChange}
                    placeholder="quick-bite, comfort-food, culinary-experience..."
                    variant="outline"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
