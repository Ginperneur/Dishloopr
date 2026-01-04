import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SearchBar } from '@/components/search/SearchBar';
import { RestaurantCard } from '@/components/restaurant/RestaurantCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { searchRestaurants, cuisineTypes, ambienceTags, cities } from '@/data/mockData';

type SortOption = 'bestMatch' | 'highestRated' | 'mostReviews' | 'priceLowHigh' | 'priceHighLow';

interface Filters {
  priceLevel: number[];
  ambienceTags: string[];
  cuisines: string[];
}

export default function SearchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const dishQuery = searchParams.get('dish') || '';
  const cityId = searchParams.get('city') || 'all';
  
  const [filters, setFilters] = useState<Filters>({
    priceLevel: [],
    ambienceTags: [],
    cuisines: [],
  });
  const [sortBy, setSortBy] = useState<SortOption>('bestMatch');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const results = searchRestaurants(dishQuery, cityId, filters);

  // Apply sorting
  const sortedResults = [...results].sort((a, b) => {
    switch (sortBy) {
      case 'highestRated':
        return b.rating - a.rating;
      case 'mostReviews':
        return b.reviewCount - a.reviewCount;
      case 'priceLowHigh':
        return a.priceLevel - b.priceLevel;
      case 'priceHighLow':
        return b.priceLevel - a.priceLevel;
      default:
        return 0; // Keep original order (best match from search)
    }
  });

  const handleSearch = (query: string, newCityId: string) => {
    const params = new URLSearchParams();
    if (query) params.set('dish', query);
    if (newCityId && newCityId !== 'all') params.set('city', newCityId);
    setSearchParams(params);
  };

  const toggleFilter = (type: keyof Filters, value: string | number) => {
    setFilters(prev => {
      const current = prev[type] as (string | number)[];
      const updated = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return { ...prev, [type]: updated };
    });
  };

  const clearFilters = () => {
    setFilters({
      priceLevel: [],
      ambienceTags: [],
      cuisines: [],
    });
  };

  const activeFilterCount = 
    filters.priceLevel.length + 
    filters.ambienceTags.length + 
    filters.cuisines.length;

  const cityName = cityId === 'all' 
    ? t('cities.all') 
    : cities.find(c => c.id === cityId)?.name || '';

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Price Level */}
      <div>
        <h4 className="font-semibold mb-3">{t('filters.priceLevel')}</h4>
        <div className="space-y-2">
          {[
            { value: 1, label: `€ · ${t('filters.budget')}` },
            { value: 2, label: `€€ · ${t('filters.moderate')}` },
            { value: 3, label: `€€€ · ${t('filters.upscale')}` },
            { value: 4, label: `€€€€ · ${t('filters.luxury')}` },
          ].map((price) => (
            <label key={price.value} className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={filters.priceLevel.includes(price.value)}
                onCheckedChange={() => toggleFilter('priceLevel', price.value)}
              />
              <span className="text-sm">{price.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Ambience */}
      <div>
        <h4 className="font-semibold mb-3">{t('filters.ambience')}</h4>
        <div className="space-y-2">
          {['romantic', 'family-friendly', 'high-end', 'cozy', 'business'].map((tag) => (
            <label key={tag} className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={filters.ambienceTags.includes(tag)}
                onCheckedChange={() => toggleFilter('ambienceTags', tag)}
              />
              <span className="text-sm">{t(`filters.${tag.replace('-', '')}`)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Cuisine */}
      <div>
        <h4 className="font-semibold mb-3">{t('filters.cuisine')}</h4>
        <div className="space-y-2">
          {cuisineTypes.slice(0, 8).map((cuisine) => (
            <label key={cuisine} className="flex items-center gap-3 cursor-pointer capitalize">
              <Checkbox
                checked={filters.cuisines.includes(cuisine)}
                onCheckedChange={() => toggleFilter('cuisines', cuisine)}
              />
              <span className="text-sm">{cuisine}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button variant="outline" className="w-full" onClick={clearFilters}>
          {t('filters.clearAll')}
        </Button>
      )}
    </div>
  );

  return (
    <Layout>
      {/* Search Header */}
      <div className="sticky top-16 z-40 bg-background border-b border-border py-4">
        <div className="container">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <SearchBar 
                variant="compact" 
                initialQuery={dishQuery}
                initialCity={cityId}
                onSearch={handleSearch}
              />
            </div>
            
            {/* Mobile Filter Button */}
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden relative">
                  <SlidersHorizontal className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>{t('filters.title')}</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <FilterContent />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-36">
              <h3 className="font-bold text-lg mb-4">{t('filters.title')}</h3>
              <FilterContent />
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold">
                  {dishQuery ? (
                    <>
                      {dishQuery} {cityName && `in ${cityName}`}
                    </>
                  ) : (
                    <>Restaurants {cityName && `in ${cityName}`}</>
                  )}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {sortedResults.length} {t('search.results')}
                </p>
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bestMatch">{t('sort.bestMatch')}</SelectItem>
                  <SelectItem value="highestRated">{t('sort.highestRated')}</SelectItem>
                  <SelectItem value="mostReviews">{t('sort.mostReviews')}</SelectItem>
                  <SelectItem value="priceLowHigh">{t('sort.priceLowHigh')}</SelectItem>
                  <SelectItem value="priceHighLow">{t('sort.priceHighLow')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active Filters */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {filters.priceLevel.map(p => (
                  <Badge 
                    key={`price-${p}`} 
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => toggleFilter('priceLevel', p)}
                  >
                    {'€'.repeat(p)}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
                {filters.ambienceTags.map(tag => (
                  <Badge 
                    key={`tag-${tag}`} 
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => toggleFilter('ambienceTags', tag)}
                  >
                    {t(`filters.${tag.replace('-', '')}`)}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
                {filters.cuisines.map(c => (
                  <Badge 
                    key={`cuisine-${c}`} 
                    variant="secondary"
                    className="cursor-pointer capitalize"
                    onClick={() => toggleFilter('cuisines', c)}
                  >
                    {c}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  {t('filters.clearAll')}
                </Button>
              </div>
            )}

            {/* Results Grid */}
            {sortedResults.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
                {sortedResults.map((restaurant, index) => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <p className="text-xl font-semibold mb-2">{t('search.noResults')}</p>
                <p className="text-muted-foreground">{t('search.tryDifferent')}</p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
