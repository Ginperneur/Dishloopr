import { useState, useEffect } from 'react';
import { Tag, Plus, Crown, Loader2, X, ShoppingCart, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { CHECKOUT_ENABLED, COMING_SOON_LABEL, COMING_SOON_TOAST } from '@/lib/checkoutFlags';
import { sendAnalyticsEvent } from '@/lib/cookieConsent';

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
  // The free tag (first in each list) is the owner's own choice, saved through
  // set_free_restaurant_tag so only one tag from the fixed lists can be set this way.
  // One draft per category, so choices in several categories stay put until "Tags opslaan".
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Record<string, boolean>>({});
  const [savingFree, setSavingFree] = useState(false);
  const pendingCount = Object.values(drafts).filter(Boolean).length;

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
    sendAnalyticsEvent('click_package', { package: 'extra_tag' });
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

  const saveFreeTags = async () => {
    setSavingFree(true);
    let updated = { ...restaurant };
    const failed: { key: string; label: string }[] = [];
    for (const { key, dbField, label } of TAG_CATEGORIES) {
      const value = drafts[key];
      if (!value) continue;
      const { data, error } = await supabase.rpc('set_free_restaurant_tag' as never, {
        p_restaurant_id: restaurant.id, p_category: key, p_value: value,
      } as never);
      if (error) failed.push({ key, label }); else updated = { ...updated, [dbField]: data as unknown as string[] };
    }
    setSavingFree(false);
    onUpdate(updated);
    if (failed.length) {
      toast.error(`Opslaan lukte niet voor: ${failed.map(f => f.label).join(', ')}`);
      setDrafts(d => Object.fromEntries(Object.entries(d).filter(([k]) => failed.some(f => f.key === k))));
      return;
    }
    setDrafts({});
    setEditing({});
    toast.success('Tags opgeslagen');
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
          Kies per categorie zelf 1 gratis tag die het best bij je zaak past. Extra tags kosten €5 per maand per tag (max 3), of zitten bij Owner Pro (€29 per maand) inbegrepen.
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
                    {idx > 0 && <Crown className="h-3 w-3 mr-1" />}
                    {tag}
                    {idx === 0 && <span className="ml-1 opacity-80">(gratis)</span>}
                  </Badge>
                ))}
                {currentTags.length > 0 && !editing[key] && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(e => ({ ...e, [key]: true }))}>
                    <Pencil className="h-3 w-3 mr-1" /> Wijzigen
                  </Button>
                )}
              </div>

              {(currentTags.length === 0 || editing[key]) && (
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={drafts[key] ?? ''}
                    onValueChange={(v) => setDrafts(d => ({ ...d, [key]: v }))}
                  >
                    <SelectTrigger className="h-9 w-56 text-sm" aria-label={`Gratis tag voor ${label}`}>
                      <SelectValue placeholder={currentTags.length ? 'Kies een andere tag' : 'Kies je gratis tag'} />
                    </SelectTrigger>
                    <SelectContent>
                      {options.filter(o => o !== currentTags[0]).map(opt => (
                        <SelectItem key={opt} value={opt} className="text-sm">{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {drafts[key] && <span className="text-xs text-muted-foreground">Nog niet opgeslagen</span>}
                  {currentTags.length > 0 && (
                    <Button size="sm" variant="ghost" className="h-9 w-9 p-0" aria-label="Annuleren"
                      onClick={() => { setEditing(e => ({ ...e, [key]: false })); setDrafts(d => { const n = { ...d }; delete n[key]; return n; }); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}

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

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={saveFreeTags} disabled={pendingCount === 0 || savingFree} className="min-h-11">
            {savingFree && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Tags opslaan{pendingCount > 0 ? ` (${pendingCount})` : ''}
          </Button>
          {pendingCount > 0 && <span className="text-sm text-muted-foreground">Je keuzes worden pas bewaard als je op Tags opslaan klikt.</span>}
        </div>

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
