import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';

interface Filters {
  priceLevel: number[];
  ambienceTags: string[];
  cuisines: string[];
  concepts: string[];
  mealTypes: string[];
  experiences: string[];
  dietaryOptions: string[];
  hasTerrace?: boolean;
  openNow?: boolean;
  radiusKm?: number;
}

interface FilterPopoverProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  availableCuisines: string[];
}

const AMBIENCE_OPTIONS = [
  { value: 'romantisch', key: 'filters.romantic' },
  { value: 'gezellig', key: 'filters.cozy' },
  { value: 'trendy', key: 'filters.trendy' },
  { value: 'casual', key: 'filters.casual' },
  { value: 'luxe', key: 'filters.luxury' },
  { value: 'zakelijk', key: 'filters.business' },
  { value: 'kindvriendelijk', key: 'filters.familyFriendly' },
];

const CONCEPT_OPTIONS = [
  { value: 'shared dining', key: 'filters.sharedDining' },
  { value: 'all you can eat', key: 'filters.allYouCanEat' },
  { value: 'tasting menu', key: 'filters.tastingMenu' },
  { value: 'à la carte', key: 'filters.aLaCarte' },
  { value: 'buffet', key: 'filters.buffet' },
  { value: 'omakase', key: 'filters.omakase' },
  { value: 'prix fixe', key: 'filters.prixFixe' },
  { value: 'pop-up', key: 'filters.popUp' },
  { value: 'food truck', key: 'filters.foodTruck' },
  { value: 'chefs table', key: 'filters.chefsTable' },
  { value: 'street food', key: 'filters.streetFood' },
  { value: 'wine pairing', key: 'filters.winePairing' },
  { value: 'farm-to-table', key: 'filters.farmToTable' },
];

const MEAL_TYPE_OPTIONS = [
  { value: 'breakfast', key: 'filters.breakfast' },
  { value: 'brunch', key: 'filters.brunch' },
  { value: 'lunch', key: 'filters.lunch' },
  { value: 'dinner', key: 'filters.dinner' },
];

const EXPERIENCE_OPTIONS = [
  { value: 'quick-bite', key: 'filters.quickBite' },
  { value: 'comfort-food', key: 'filters.comfortFood' },
  { value: 'culinary-experience', key: 'filters.culinaryExperience' },
  { value: 'late-night', key: 'filters.lateNight' },
  { value: 'celebration', key: 'filters.celebration' },
];

const DIETARY_OPTIONS = [
  { value: 'vegan', key: 'filters.vegan', emoji: '🌱' },
  { value: 'gluten-free', key: 'filters.glutenFree', emoji: '🌾' },
  { value: 'halal', key: 'filters.halal', emoji: '✓' },
  { value: 'lactose-free', key: 'filters.lactoseFree', emoji: '🥛' },
];

// Popular cuisine options for featured restaurants filter
const CUISINE_OPTIONS = [
  { value: 'japanese', key: 'cuisines.japanese' },
  { value: 'italian', key: 'cuisines.italian' },
  { value: 'french', key: 'cuisines.french' },
  { value: 'chinese', key: 'cuisines.chinese' },
  { value: 'indian', key: 'cuisines.indian' },
  { value: 'mexican', key: 'cuisines.mexican' },
  { value: 'thai', key: 'cuisines.thai' },
  { value: 'greek', key: 'cuisines.greek' },
  { value: 'spanish', key: 'cuisines.spanish' },
  { value: 'korean', key: 'cuisines.korean' },
  { value: 'vietnamese', key: 'cuisines.vietnamese' },
  { value: 'american', key: 'cuisines.american' },
  { value: 'turkish', key: 'cuisines.turkish' },
  { value: 'indonesian', key: 'cuisines.indonesian' },
  { value: 'moroccan', key: 'cuisines.moroccan' },
  { value: 'lebanese', key: 'cuisines.lebanese' },
  { value: 'persian', key: 'cuisines.persian' },
  { value: 'caribbean', key: 'cuisines.caribbean' },
  { value: 'portuguese', key: 'cuisines.portuguese' },
  { value: 'middle-eastern', key: 'cuisines.middleEastern' },
  { value: 'african', key: 'cuisines.african' },
  { value: 'argentinian', key: 'cuisines.argentinian' },
  { value: 'brazilian', key: 'cuisines.brazilian' },
  { value: 'filipino', key: 'cuisines.filipino' },
  { value: 'surinamese', key: 'cuisines.surinamese' },
  { value: 'vegetarian', key: 'cuisines.vegetarian' },
  { value: 'vegan', key: 'cuisines.vegan' },
  { value: 'seafood', key: 'cuisines.seafood' },
  { value: 'steakhouse', key: 'cuisines.steakhouse' },
  { value: 'sushi', key: 'cuisines.sushi' },
  { value: 'mediterranean', key: 'cuisines.mediterranean' },
];

const PRICE_OPTIONS = [
  { value: 1, label: '€', description: 'filters.budget' },
  { value: 2, label: '€€', description: 'filters.moderate' },
  { value: 3, label: '€€€', description: 'filters.upscale' },
  { value: 4, label: '€€€€', description: 'filters.luxury' },
];

export function FilterPopover({ filters, onFiltersChange, availableCuisines }: FilterPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const activeFilterCount = 
    filters.priceLevel.length + 
    filters.ambienceTags.length + 
    filters.cuisines.length +
    filters.concepts.length +
    filters.mealTypes.length +
    filters.experiences.length +
    filters.dietaryOptions.length +
    (filters.hasTerrace ? 1 : 0) +
    (filters.openNow ? 1 : 0) +
    (filters.radiusKm && filters.radiusKm > 0 ? 1 : 0);

  const toggleFilter = (type: keyof Filters, value: string | number) => {
    const current = filters[type] as (string | number)[];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [type]: updated });
  };

  const clearFilters = () => {
    onFiltersChange({
      priceLevel: [],
      ambienceTags: [],
      cuisines: [],
      concepts: [],
      mealTypes: [],
      experiences: [],
      dietaryOptions: [],
      hasTerrace: undefined,
      openNow: undefined,
      radiusKm: 0,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">{t('filters.title')}</span>
          {activeFilterCount > 0 && (
            <Badge variant="default" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t('filters.title')}</h3>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                {t('filters.clearAll')}
              </Button>
            )}
          </div>
          {/* Primary quick-toggle chips: dietary + terrace */}
          <div className="flex flex-wrap gap-2 mt-3">
            {/* Open now filter */}
            <button
              onClick={() => onFiltersChange({ ...filters, openNow: filters.openNow ? undefined : true })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                filters.openNow
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              <span>🕐</span>
              <span>{t('filters.openNow', 'Open nu')}</span>
            </button>
            {/* Terrace filter */}
            <button
              onClick={() => onFiltersChange({ ...filters, hasTerrace: filters.hasTerrace ? undefined : true })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                filters.hasTerrace
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              <span>☀️</span>
              <span>{t('filters.terrace', 'Terras')}</span>
            </button>
            {DIETARY_OPTIONS.map((option) => {
              const isActive = filters.dietaryOptions.includes(option.value);
              return (
                <button
                  key={option.value}
                  onClick={() => toggleFilter('dietaryOptions', option.value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    isActive
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  <span>{option.emoji}</span>
                  <span>{t(option.key)}</span>
                </button>
              );
            })}
          </div>
          {/* Distance slider — expand search around the selected city */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                {t('filters.distanceFromCity', 'Afstand rond stad')}
              </label>
              <span className="text-xs font-semibold">
                {filters.radiusKm && filters.radiusKm > 0
                  ? `+${filters.radiusKm} km`
                  : t('filters.onlyInCity', 'Alleen in stad')}
              </span>
            </div>
            <Slider
              value={[filters.radiusKm ?? 0]}
              min={0}
              max={60}
              step={5}
              onValueChange={(v) => onFiltersChange({ ...filters, radiusKm: v[0] })}
              aria-label={t('filters.distanceAria', 'Maximale afstand tot de stad in kilometers')}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0</span>
              <span>15</span>
              <span>30</span>
              <span>45</span>
              <span>60 km</span>
            </div>
          </div>
        </div>
        
        <Tabs defaultValue="price" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto flex-wrap">
            <TabsTrigger 
              value="price" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm"
            >
              {t('filters.price')}
              {filters.priceLevel.length > 0 && (
                <span className="ml-1 text-xs text-primary">({filters.priceLevel.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="mealType"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm"
            >
              {t('filters.mealType')}
              {filters.mealTypes.length > 0 && (
                <span className="ml-1 text-xs text-primary">({filters.mealTypes.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="experience"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm"
            >
              {t('filters.experience')}
              {filters.experiences.length > 0 && (
                <span className="ml-1 text-xs text-primary">({filters.experiences.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="ambience"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm"
            >
              {t('filters.ambience')}
              {filters.ambienceTags.length > 0 && (
                <span className="ml-1 text-xs text-primary">({filters.ambienceTags.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="concept"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm"
            >
              {t('filters.concept')}
              {filters.concepts.length > 0 && (
                <span className="ml-1 text-xs text-primary">({filters.concepts.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="cuisine"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-sm"
            >
              {t('filters.cuisine')}
              {filters.cuisines.length > 0 && (
                <span className="ml-1 text-xs text-primary">({filters.cuisines.length})</span>
              )}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[280px]">
            <TabsContent value="price" className="p-4 mt-0 space-y-2">
              {PRICE_OPTIONS.map((price) => (
                <label 
                  key={price.value} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={filters.priceLevel.includes(price.value)}
                    onCheckedChange={() => toggleFilter('priceLevel', price.value)}
                  />
                  <span className="font-medium w-12">{price.label}</span>
                  <span className="text-sm text-muted-foreground">{t(price.description)}</span>
                </label>
              ))}
            </TabsContent>

            <TabsContent value="mealType" className="p-4 mt-0 space-y-2">
              {MEAL_TYPE_OPTIONS.map((option) => (
                <label 
                  key={option.value} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={filters.mealTypes.includes(option.value)}
                    onCheckedChange={() => toggleFilter('mealTypes', option.value)}
                  />
                  <span className="text-sm">{t(option.key)}</span>
                </label>
              ))}
            </TabsContent>

            <TabsContent value="experience" className="p-4 mt-0 space-y-2">
              {EXPERIENCE_OPTIONS.map((option) => (
                <label 
                  key={option.value} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={filters.experiences.includes(option.value)}
                    onCheckedChange={() => toggleFilter('experiences', option.value)}
                  />
                  <span className="text-sm">{t(option.key)}</span>
                </label>
              ))}
            </TabsContent>

            <TabsContent value="ambience" className="p-4 mt-0 space-y-2">
              {AMBIENCE_OPTIONS.map((option) => (
                <label 
                  key={option.value} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={filters.ambienceTags.includes(option.value)}
                    onCheckedChange={() => toggleFilter('ambienceTags', option.value)}
                  />
                  <span className="text-sm">{t(option.key)}</span>
                </label>
              ))}
            </TabsContent>

            <TabsContent value="concept" className="p-4 mt-0 space-y-2">
              {CONCEPT_OPTIONS.map((option) => (
                <label 
                  key={option.value} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={filters.concepts.includes(option.value)}
                    onCheckedChange={() => toggleFilter('concepts', option.value)}
                  />
                  <span className="text-sm">{t(option.key)}</span>
                </label>
              ))}
            </TabsContent>

            <TabsContent value="cuisine" className="p-4 mt-0 space-y-2">
              {/* Show predefined cuisine options first */}
              {CUISINE_OPTIONS.map((option) => (
                <label 
                  key={option.value} 
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors capitalize"
                >
                  <Checkbox
                    checked={filters.cuisines.includes(option.value)}
                    onCheckedChange={() => toggleFilter('cuisines', option.value)}
                  />
                  <span className="text-sm">{t(option.key, option.value)}</span>
                </label>
              ))}
              {/* Show any additional cuisines from database that aren't in the predefined list */}
              {availableCuisines
                .filter(c => !CUISINE_OPTIONS.some(opt => opt.value === c.toLowerCase()))
                .map((cuisine) => (
                  <label 
                    key={cuisine} 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors capitalize"
                  >
                    <Checkbox
                      checked={filters.cuisines.includes(cuisine)}
                      onCheckedChange={() => toggleFilter('cuisines', cuisine)}
                    />
                    <span className="text-sm">{cuisine}</span>
                  </label>
                ))}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="p-4 border-t border-border">
          <Button className="w-full" onClick={() => setOpen(false)}>
            <Check className="h-4 w-4 mr-2" />
            {t('filters.apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
