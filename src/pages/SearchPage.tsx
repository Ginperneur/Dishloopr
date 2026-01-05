import { useState, useEffect, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { SlidersHorizontal, X, Map, LayoutGrid, Navigation, Loader2 } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SearchBar } from '@/components/search/SearchBar';
import { DatabaseRestaurantCard } from '@/components/restaurant/DatabaseRestaurantCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { SEOHead } from '@/components/seo/SEOHead';
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
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import { toast } from 'sonner';

// Lazy load the map component
const RestaurantMap = lazy(() => import('@/components/map/RestaurantMap').then(m => ({ default: m.RestaurantMap })));

type SortOption = 'bestMatch' | 'highestRated' | 'mostReviews' | 'priceLowHigh' | 'priceHighLow' | 'nearest';
type ViewMode = 'grid' | 'map';

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
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  
  // Geolocation for "near me" feature
  const { latitude, longitude, loading: locationLoading, requestLocation } = useGeolocation();
  const userLocation = latitude && longitude ? { lat: latitude, lng: longitude } : null;

  // Get unique cuisines from database
  const availableCuisines = [...new Set(dishes.flatMap(d => d.cuisine_tags || []))];

  // Perform search when query, city, or filters change
  useEffect(() => {
    search(dishQuery, cityId, filters);
  }, [dishQuery, cityId, filters]);

  // Apply sorting (including distance-based)
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
      case 'nearest':
        if (!userLocation) return 0;
        const distA = a.geo_lat && a.geo_lng 
          ? calculateDistance(userLocation.lat, userLocation.lng, a.geo_lat, a.geo_lng)
          : Infinity;
        const distB = b.geo_lat && b.geo_lng
          ? calculateDistance(userLocation.lat, userLocation.lng, b.geo_lat, b.geo_lng)
          : Infinity;
        return distA - distB;
      default:
        return 0; // Keep original order (best match from search)
    }
  });

  // Handle near me click
  const handleNearMe = () => {
    if (locationLoading) return;
    
    if (!userLocation) {
      requestLocation();
      toast.info('Locatie wordt opgehaald...');
    } else {
      setSortBy('nearest');
      toast.success('Gesorteerd op afstand');
    }
  };

  // Auto-sort by nearest when location becomes available
  useEffect(() => {
    if (userLocation && sortBy === 'nearest') {
      // Location is now available, results will re-sort
    }
  }, [userLocation, sortBy]);

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

  const pageTitle = dishQuery 
    ? `${dishQuery} restaurants${cityId && cityId !== 'all' ? ` in ${cities.find(c => c.id === cityId)?.name || ''}` : ''}`
    : 'Zoek restaurants';

  return (
    <Layout>
      <SEOHead
        title={`${pageTitle} | Dishloopr`}
        description={`Vind de beste ${dishQuery || 'restaurants'}${cityId && cityId !== 'all' ? ` in ${cities.find(c => c.id === cityId)?.name || 'Nederland'}` : ' in Nederland'}. Bekijk reviews, menu's en reserveer direct.`}
        keywords={[dishQuery || 'restaurants', 'eten', 'uit eten', 'Nederland', 'reviews'].filter(Boolean) as string[]}
      />
      {/* Search Header */}
      <div className="sticky top-14 md:top-16 z-40 bg-background border-b border-border py-3 md:py-4">
        <div className="container px-4 md:px-6">
          <div className="flex items-center gap-3">
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
                <Button variant="outline" size="icon" className="lg:hidden relative shrink-0">
                  <SlidersHorizontal className="h-4 w-4" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-sm">
                <SheetHeader>
                  <SheetTitle>{t('filters.title')}</SheetTitle>
                </SheetHeader>
                <div className="mt-6 overflow-y-auto max-h-[calc(100vh-120px)]">
                  <FilterContent />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <div className="container px-4 md:px-6 py-4 md:py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-36">
              <h3 className="font-bold text-lg mb-4">{t('filters.title')}</h3>
              <FilterContent />
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            {/* Results Header */}
            <div className="flex flex-col gap-3 mb-4 md:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold truncate">
                    {dishQuery ? (
                      <>
                        {dishQuery} {cityName && `in ${cityName}`}
                      </>
                    ) : (
                      <>Restaurants {cityName && `in ${cityName}`}</>
                    )}
                  </h1>
                  <p className="text-muted-foreground text-sm mt-0.5">
                    {loading ? 'Zoeken...' : `${sortedResults.length} ${t('search.results')}`}
                  </p>
                </div>

                {/* View Mode Toggle + Sort */}
                <div className="flex items-center gap-2">
                  {/* Near Me Button */}
                  <Button
                    variant={sortBy === 'nearest' ? 'default' : 'outline'}
                    size="sm"
                    onClick={handleNearMe}
                    disabled={locationLoading}
                    className="shrink-0"
                  >
                    {locationLoading ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4 mr-1.5" />
                    )}
                    <span className="hidden sm:inline">Bij mij</span>
                  </Button>

                  {/* View Mode Toggle */}
                  <div className="flex items-center border border-border rounded-lg p-0.5">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setViewMode('grid')}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'map' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setViewMode('map')}
                    >
                      <Map className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Sort */}
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bestMatch">{t('sort.bestMatch')}</SelectItem>
                      <SelectItem value="highestRated">{t('sort.highestRated')}</SelectItem>
                      <SelectItem value="mostReviews">{t('sort.mostReviews')}</SelectItem>
                      <SelectItem value="priceLowHigh">{t('sort.priceLowHigh')}</SelectItem>
                      <SelectItem value="priceHighLow">{t('sort.priceHighLow')}</SelectItem>
                      {userLocation && <SelectItem value="nearest">Dichtstbij</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Active Filters */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 md:mb-6">
                {filters.priceLevel.map(p => (
                  <Badge 
                    key={`price-${p}`} 
                    variant="secondary"
                    className="cursor-pointer text-xs"
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
                    className="cursor-pointer capitalize text-xs"
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
                    className="cursor-pointer capitalize text-xs"
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
                    className="cursor-pointer capitalize text-xs"
                    onClick={() => toggleFilter('concepts', c)}
                  >
                    {c}
                    <X className="h-3 w-3 ml-1" />
                  </Badge>
                ))}
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs px-2">
                  {t('filters.clearAll')}
                </Button>
              </div>
            )}

            {/* Results - Grid or Map View */}
            {viewMode === 'map' ? (
              <Suspense fallback={
                <div className="h-[60vh] bg-muted rounded-xl animate-pulse flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              }>
                <div className="h-[60vh] rounded-xl overflow-hidden">
                  <RestaurantMap
                    restaurants={sortedResults.map(r => ({
                      id: r.id,
                      name: r.name,
                      slug: r.slug,
                      address: r.address,
                      rating: Number(r.rating),
                      review_count: r.review_count,
                      geo_lat: r.geo_lat,
                      geo_lng: r.geo_lng,
                      is_featured: r.is_featured,
                      is_top_listing: r.is_top_listing,
                      images: r.images,
                      price_level: r.price_level,
                    }))}
                    userLocation={userLocation}
                    className="h-full"
                  />
                </div>
              </Suspense>
            ) : loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {[1, 2, 3, 4].map(i => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : sortedResults.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {sortedResults.map((restaurant, index) => (
                  <DatabaseRestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    index={index}
                    isSponsored={restaurant.isSponsored}
                  />
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 md:py-16"
              >
                <p className="text-lg md:text-xl font-semibold mb-2">{t('search.noResults')}</p>
                <p className="text-muted-foreground text-sm md:text-base">{t('search.tryDifferent')}</p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
