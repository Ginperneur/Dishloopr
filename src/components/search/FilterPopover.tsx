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

interface Filters {
  priceLevel: number[];
  ambienceTags: string[];
  cuisines: string[];
  concepts: string[];
}

interface FilterPopoverProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  availableCuisines: string[];
}

const AMBIENCE_OPTIONS = [
  { value: 'romantic', key: 'filters.romantic' },
  { value: 'family-friendly', key: 'filters.familyFriendly' },
  { value: 'high-end', key: 'filters.highEnd' },
  { value: 'cozy', key: 'filters.cozy' },
  { value: 'business', key: 'filters.business' },
  { value: 'trendy', key: 'filters.trendy' },
  { value: 'casual', key: 'filters.casual' },
  { value: 'lively', key: 'filters.lively' },
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
    filters.concepts.length;

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
        </div>
        
        <Tabs defaultValue="price" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-auto">
            <TabsTrigger 
              value="price" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              {t('filters.price')}
              {filters.priceLevel.length > 0 && (
                <span className="ml-1 text-xs text-primary">({filters.priceLevel.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="ambience"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              {t('filters.ambience')}
              {filters.ambienceTags.length > 0 && (
                <span className="ml-1 text-xs text-primary">({filters.ambienceTags.length})</span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="concept"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
            >
              {t('filters.concept')}
              {filters.concepts.length > 0 && (
                <span className="ml-1 text-xs text-primary">({filters.concepts.length})</span>
              )}
            </TabsTrigger>
            {availableCuisines.length > 0 && (
              <TabsTrigger 
                value="cuisine"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                {t('filters.cuisine')}
                {filters.cuisines.length > 0 && (
                  <span className="ml-1 text-xs text-primary">({filters.cuisines.length})</span>
                )}
              </TabsTrigger>
            )}
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

            {availableCuisines.length > 0 && (
              <TabsContent value="cuisine" className="p-4 mt-0 space-y-2">
                {availableCuisines.map((cuisine) => (
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
            )}
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
