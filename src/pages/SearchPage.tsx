import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { SlidersHorizontal, X } from 'lucide-react';
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
import { useSearch } from '@/hooks/useSearch';

type SortOption = 'bestMatch' | 'highestRated' | 'mostReviews' | 'priceLowHigh' | 'priceHighLow';

interface Filters {
  priceLevel: number[];
  ambienceTags: string[];
  cuisines: string[];
  concepts: string[];
}

const AMBIENCE_OPTIONS = ['romantic', 'family-friendly', 'high-end', 'cozy', 'business', 'trendy', 'casual', 'lively'];
const CONCEPT_OPTIONS = ['shared dining', 'all you can eat', 'tasting menu', 'à la carte', 'buffet', 'omakase', 'prix fixe', 'pop-up'];

export default function SearchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { search, results, loading, cities, dishes } = useSearch();
  
  const dishQuery = searchParams.get('dish') || '';
  const cityId = searchParams.get('city') || 'all';
  
  const [filters, setFilters] = useState<Filters>({
    priceLevel: [],
    ambienceTags: [],
    cuisines: [],
    concepts: [],
  });
  const [sortBy, setSortBy] = useState<SortOption>('bestMatch');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Get unique cuisines from database
  const availableCuisines = [...new Set(dishes.flatMap(d => d.cuisine_tags || []))];

  // Perform search when query, city, or filters change
  useEffect(() => {
    search(dishQuery, cityId, filters);
  }, [dishQuery, cityId, filters]);

  // Apply sorting
  const sortedResults = [...results].sort((a, b) => {
    switch (sortBy) {
      case 'highestRated':
        return Number(b.rating) - Number(a.rating);
      case 'mostReviews':
        return b.review_count - a.review_count;
      case 'priceLowHigh':
        return a.price_level - b.price_level;
      case 'priceHighLow':
        return b.price_level - a.price_level;
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
      concepts: [],
    });
  };

  const activeFilterCount = 
    filters.priceLevel.length + 
    filters.ambienceTags.length + 
    filters.cuisines.length +
    filters.concepts.length;

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
          {AMBIENCE_OPTIONS.map((tag) => (
            <label key={tag} className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={filters.ambienceTags.includes(tag)}
                onCheckedChange={() => toggleFilter('ambienceTags', tag)}
              />
              <span className="text-sm capitalize">{tag.replace('-', ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Cuisine */}
      {availableCuisines.length > 0 && (
        <div>
          <h4 className="font-semibold mb-3">{t('filters.cuisine')}</h4>
          <div className="space-y-2">
            {availableCuisines.slice(0, 10).map((cuisine) => (
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
      )}

      {/* Concept */}
      <div>
        <h4 className="font-semibold mb-3">{t('filters.concept')}</h4>
        <div className="space-y-2">
          {CONCEPT_OPTIONS.map((concept) => (
            <label key={concept} className="flex items-center gap-3 cursor-pointer capitalize">
              <Checkbox
                checked={filters.concepts.includes(concept)}
                onCheckedChange={() => toggleFilter('concepts', concept)}
              />
              <span className="text-sm">{concept}</span>
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

  // Convert search results to format expected by RestaurantCard
  const restaurantCards = sortedResults.map(r => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    cityId: r.city_id,
    address: r.address,
    postalCode: r.postal_code || '',
    geoLat: Number(r.geo_lat) || 0,
    geoLng: Number(r.geo_lng) || 0,
    priceLevel: r.price_level as 1 | 2 | 3 | 4,
    cuisines: r.cuisines || [],
    ambienceTags: r.ambience_tags || [],
    dishes: [],
    phone: r.phone || '',
    websiteUrl: r.website_url || '',
    reservationUrl: r.reservation_url,
    openingHours: typeof r.opening_hours === 'object' ? r.opening_hours as { [key: string]: string } : {},
    images: r.images || [],
    rating: Number(r.rating),
    reviewCount: r.review_count,
    isFeatured: r.is_featured,
    featuredUntil: r.featured_until,
    isTopListing: r.is_top_listing,
    topUntil: r.top_until,
    claimedByOwnerId: r.claimed_by_owner_id,
  }));

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
                  {loading ? 'Zoeken...' : `${sortedResults.length} ${t('search.results')}`}
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
                    className="cursor-pointer capitalize"
                    onClick={() => toggleFilter('ambienceTags', tag)}
                  >
                    {tag.replace('-', ' ')}
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
                {filters.concepts.map(c => (
                  <Badge 
                    key={`concept-${c}`} 
                    variant="secondary"
                    className="cursor-pointer capitalize"
                    onClick={() => toggleFilter('concepts', c)}
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
            {loading ? (
              <div className="grid md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-64 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : sortedResults.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-6">
                {restaurantCards.map((restaurant, index) => (
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
