import { useState, useEffect } from 'react';
import { Tag, Plus, Crown, Loader2, X, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { CHECKOUT_ENABLED, COMING_SOON_LABEL, COMING_SOON_TOAST } from '@/lib/checkoutFlags';

const VALID_CUISINES = [
  "Italiaans", "Japans", "Chinees", "Indiaas", "Mexicaans", "Thais", "Grieks",
  "Spaans", "Koreaans", "Vietnamees", "Amerikaans", "Frans", "Turks", "Marokkaans",
  "Surinaams", "Indonesisch", "Aziatisch", "Mediterraans", "Nederlands", "Internationaal",
  "Fusion", "Midden-Oosters", "Ethiopisch", "Braziliaans", "Peruaans", "Argentijns",
  "Caribisch", "Afghaans", "Libanees", "Steakhouse", "Sushi", "Vis & Zeevruchten",
  "Vegetarisch", "Veganistisch", "Pizza", "Burger", "BBQ", "Ramen", "Dim Sum",
  "Tapas", "Bistro", "Brasserie", "Gastropub"
];

const VALID_AMBIENCE = [
  "Gezellig", "Romantisch", "Modern", "Trendy", "Klassiek", "Casual", "Fine Dining",
  "Kindvriendelijk", "Zakelijk", "Levendig", "Intiem", "Industrieel", "Traditioneel",
  "Luxe", "Bohemian", "Minimalistisch", "Warm", "Bruisend"
];

const VALID_CONCEPTS = [
  "All you can eat", "Shared dining", "Teppanyaki", "Omakase", "Farm to table",
  "Street food", "Food hall", "Pop-up", "Buffet", "À la carte", "Tasting menu",
  "Brunch spot", "Lunchroom", "Grand café", "Eetcafé", "Foodtruck", "Dark kitchen",
  "Open keuken", "Chef's table", "Terras restaurant"
];

const VALID_EXPERIENCES = [
  "Quick bite", "Comfort food", "Healthy", "Luxe avond uit", "Date night",
  "Zakendiner", "Familiefeest", "Groepsdiner", "Solo dining", "Late night"
];

const TAG_CATEGORIES = [
  { key: 'cuisine', label: 'Keuken', dbField: 'cuisines', options: VALID_CUISINES },
  { key: 'ambience', label: 'Sfeer', dbField: 'ambience_tags', options: VALID_AMBIENCE },
  { key: 'concept', label: 'Concept', dbField: 'concepts', options: VALID_CONCEPTS },
  { key: 'experience', label: 'Beleving', dbField: 'experiences', options: VALID_EXPERIENCES },
] as const;

const FREE_LIMIT = 1;
const MAX_EXTRA = 3;
const OWNER_PRO_PRICE_ID = 'price_1TKlaF3EXkDnjHC3GBXJCecX';

interface TagManagerProps {
  restaurant: any;
  onUpdate: (updated: any) => void;
}

export function TagManager({ restaurant, onUpdate }: TagManagerProps) {
  const { user } = useAuth();
  const [paidTags, setPaidTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingTag, setAddingTag] = useState<{ category: string; value: string } | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    if (restaurant?.id) fetchPaidTags();
  }, [restaurant?.id]);

  const fetchPaidTags = async () => {
    const { data } = await supabase
      .from('restaurant_tag_subscriptions')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true);
    setPaidTags(data || []);
    setLoading(false);
  };

  const getCurrentTags = (dbField: string): string[] => {
    return (restaurant as any)?.[dbField] || [];
  };

  const handleAddPaidTag = async (categoryKey: string, dbField: string, tagValue: string) => {
    if (!user) return;
    if (!CHECKOUT_ENABLED.tag) {
      toast.info(COMING_SOON_TOAST);
      return;
    }
    setCheckoutLoading(true);

    try {
      // Create checkout for per-tag subscription. Price is enforced server-side
      // (STRIPE_TAG_PRICE_ID) — do NOT pass a price from the client.
      const { data, error } = await supabase.functions.invoke('create-tag-checkout', {
        body: {
          restaurant_id: restaurant.id,
          tag_category: categoryKey,
          tag_value: tagValue,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (e: any) {
      toast.error(e.message || 'Kon checkout niet starten');
    } finally {
      setCheckoutLoading(false);
      setAddingTag(null);
    }
  };

  const getAvailableOptions = (categoryKey: string, dbField: string, options: readonly string[]) => {
    const current = getCurrentTags(dbField);
    return options.filter(o => !current.includes(o));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          Profiel Tags
        </CardTitle>
        <CardDescription>
          Je hebt 1 gratis tag per categorie. Voeg extra tags toe voor €5/maand per tag (max 3), of neem Owner Pro (€29/maand) voor dezelfde limiet zonder losse kosten.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {TAG_CATEGORIES.map(({ key, label, dbField, options }) => {
          const currentTags = getCurrentTags(dbField);
          const paidForCategory = paidTags.filter(p => p.tag_category === key);
          const extraCount = Math.max(0, currentTags.length - FREE_LIMIT);
          const canAddMore = extraCount < MAX_EXTRA;
          const available = getAvailableOptions(key, dbField, options);

          return (
            <div key={key} className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">{label}</h4>
                <span className="text-xs text-muted-foreground">
                  {currentTags.length}/{FREE_LIMIT + MAX_EXTRA} (1 gratis + max {MAX_EXTRA} extra)
                </span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {currentTags.map((tag: string, idx: number) => (
                  <Badge
                    key={tag}
                    variant={idx === 0 ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {idx === 0 && <span className="mr-1">🆓</span>}
                    {idx > 0 && <Crown className="h-3 w-3 mr-1" />}
                    {tag}
                  </Badge>
                ))}
                
                {currentTags.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">
                    Nog geen tags — wordt automatisch ingevuld door AI
                  </span>
                )}
              </div>

              {canAddMore && currentTags.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  {addingTag?.category === key ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={addingTag.value}
                        onValueChange={(v) => setAddingTag({ category: key, value: v })}
                      >
                        <SelectTrigger className="h-8 w-48 text-xs">
                          <SelectValue placeholder="Kies tag..." />
                        </SelectTrigger>
                        <SelectContent>
                          {available.slice(0, 20).map(opt => (
                            <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8 text-xs"
                        disabled={!addingTag.value || checkoutLoading || !CHECKOUT_ENABLED.tag}
                        onClick={() => handleAddPaidTag(key, dbField, addingTag.value)}
                        title={!CHECKOUT_ENABLED.tag ? COMING_SOON_LABEL : undefined}
                      >
                        {checkoutLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <ShoppingCart className="h-3 w-3 mr-1" />
                        )}
                        {CHECKOUT_ENABLED.tag ? '€5/mnd' : COMING_SOON_LABEL}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => setAddingTag(null)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setAddingTag({ category: key, value: '' })}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Extra tag toevoegen
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="border-t pt-4">
          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <Crown className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Owner Pro — €29/maand</p>
              <p className="text-xs text-muted-foreground">
                Met Owner Pro kun je onbeperkt tags beheren, krijg je toegang tot geavanceerde inzichten en meer.
                Alle extra tags zijn inbegrepen.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
