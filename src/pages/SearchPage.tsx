import { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Map, LayoutGrid, Navigation, Loader2, ArrowUp, UtensilsCrossed } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { SearchBar } from '@/components/search/SearchBar';
import { DatabaseRestaurantCard } from '@/components/restaurant/DatabaseRestaurantCard';
import { FilterPopover } from '@/components/search/FilterPopover';
import { SeoLandingLinks } from '@/components/search/SeoLandingLinks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { SEOHead, createBreadcrumbSchema } from '@/components/seo/SEOHead';
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
  mealTypes: string[];
  experiences: string[];
  dietaryOptions: string[];
  hasTerrace?: boolean;
  openNow?: boolean;
}

export default function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { search, results, loading, cities, dishes } = useSearch();
  
  const dishQuery = searchParams.get('dish') || '';
  const cityParam = searchParams.get('city') || 'all';
  const featuredOnly = searchParams.get('featured') === 'true';
  const cuisineParam = searchParams.get('cuisine') || '';
  
  // Resolve city param: could be a UUID (from dropdown) or a slug/name (from URL)
  const resolvedCityId = useMemo(() => {
    if (!cityParam || cityParam === 'all') return 'all';
    // If it's already a UUID, use directly
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cityParam)) {
      return cityParam;
    }
    // Otherwise look up by slug or name (case-insensitive)
    const match = cities.find(c => 
      c.slug === cityParam || c.name.toLowerCase() === cityParam.toLowerCase()
    );
    return match?.id || 'all';
  }, [cityParam, cities]);
  
  const [selectedCityId, setSelectedCityId] = useState(resolvedCityId);
  
  const [filters, setFilters] = useState<Filters>({
    priceLevel: [],
    ambienceTags: [],
    cuisines: cuisineParam ? [cuisineParam] : [],
    concepts: [],
    mealTypes: [],
    experiences: [],
    dietaryOptions: [],
  });
  const [sortBy, setSortBy] = useState<SortOption>('bestMatch');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [displayCount, setDisplayCount] = useState(12);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Geolocation for "near me" feature
  const { latitude, longitude, loading: locationLoading, requestLocation } = useGeolocation();
  const userLocation = latitude && longitude ? { lat: latitude, lng: longitude } : null;

  // Sync selectedCityId with resolved city ID
  useEffect(() => {
    setSelectedCityId(resolvedCityId);
  }, [resolvedCityId]);

  // Show scroll-to-top button after scrolling
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Get unique cuisines from database
  const availableCuisines = [...new Set(dishes.flatMap(d => d.cuisine_tags || []))];

  // Perform search when query, city, filters, or featured mode change
  useEffect(() => {
    search(dishQuery, selectedCityId, filters, featuredOnly);
    setDisplayCount(12); // Reset pagination on new search
  }, [dishQuery, selectedCityId, filters, featuredOnly]);

  // Handle city change for featured page
  const handleCityChange = (newCityId: string) => {
    setSelectedCityId(newCityId);
    const params = new URLSearchParams(searchParams);
    if (newCityId && newCityId !== 'all') {
      params.set('city', newCityId);
    } else {
      params.delete('city');
    }
    setSearchParams(params);
  };

  // Filter by "Open nu" client-side
  const openNowFiltered = useMemo(() => {
    if (!filters.openNow) return results;
    const now = new Date();
    const dayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
    return results.filter(r => {
      const hours = (r.opening_hours as any)?.[dayKey] || (r.opening_hours as any)?.weekday_text;
      if (!hours) return true; // If no data, include
      const h = typeof hours === 'string' ? hours : '';
      if (h === 'closed') return false;
      const match = h.match(/(\d{1,2}):?(\d{2})?\s*[-–]\s*(\d{1,2}):?(\d{2})?/);
      if (!match) return true;
      const cur = now.getHours() * 60 + now.getMinutes();
      const open = parseInt(match[1]) * 60 + parseInt(match[2] || '0');
      const close = parseInt(match[3]) * 60 + parseInt(match[4] || '0');
      return cur >= open && cur < close;
    });
  }, [results, filters.openNow]);

  // Apply sorting (including distance-based)
  const sortedResults = [...openNowFiltered].sort((a, b) => {
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

  // Paginated results
  const displayedResults = useMemo(() => 
    sortedResults.slice(0, displayCount), 
    [sortedResults, displayCount]
  );
  const hasMore = displayCount < sortedResults.length;
  
  const loadMore = () => {
    setDisplayCount(prev => Math.min(prev + 12, sortedResults.length));
  };

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
      mealTypes: [],
      experiences: [],
      dietaryOptions: [],
    });
  };

  const activeFilterCount = 
    filters.priceLevel.length + 
    filters.ambienceTags.length + 
    filters.cuisines.length +
    filters.concepts.length +
    filters.mealTypes.length +
    filters.experiences.length +
    filters.dietaryOptions.length +
    (filters.hasTerrace ? 1 : 0);

  const cityName = selectedCityId === 'all' 
    ? t('cities.all') 
    : cities.find(c => c.id === selectedCityId)?.name || '';

  const selectedCityName = selectedCityId && selectedCityId !== 'all' 
    ? cities.find(c => c.id === selectedCityId)?.name || '' 
    : '';

  const pageTitle = featuredOnly 
    ? t('search.featuredTitle', 'Uitgelichte restaurants')
    : dishQuery 
      ? selectedCityName
        ? `Beste ${dishQuery} in ${selectedCityName}`
        : `${dishQuery} restaurants in Nederland`
      : t('search.defaultTitle', 'Zoek restaurants');

  const pageDescription = dishQuery
    ? `Vind de beste ${dishQuery} restaurants${selectedCityName ? ` in ${selectedCityName}` : ' in Nederland'}. Vergelijk ${sortedResults.length}+ opties, bekijk reviews en reserveer direct.`
    : `Zoek en ontdek ${sortedResults.length}+ restaurants${selectedCityName ? ` in ${selectedCityName}` : ' in Nederland'}. Filter op gerecht, sfeer en prijs.`;

  // Always use clean canonical to avoid duplicate indexing of filtered views
  const hasFilters = !!(dishQuery || (selectedCityId && selectedCityId !== 'all'));

  return (
    <Layout>
      <SEOHead
        title={`${pageTitle} | Dishloopr`}
        description={pageDescription}
        keywords={[dishQuery || 'restaurants', 'eten', 'uit eten', selectedCityName || 'Nederland', 'reviews'].filter(Boolean) as string[]}
        canonical="https://dishloopr.com/search"
        noindex={hasFilters}
        structuredData={createBreadcrumbSchema([
          { name: 'Home', url: 'https://dishloopr.com' },
          { name: pageTitle, url: 'https://dishloopr.com/search' },
        ])}
      />
      {/* Search Header */}
      <div className="sticky top-[3.5rem] md:top-[4rem] z-40 bg-background border-b border-border py-3 md:py-4">
        <div className="container px-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <SearchBar 
                variant="compact" 
                initialQuery={dishQuery}
                initialCity={selectedCityId}
                onSearch={handleSearch}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="container px-4 md:px-6 py-4 md:py-8">
        {/* Results Header */}
        <div className="flex flex-col gap-3 mb-4 md:mb-6">
          {/* Title row */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold">
              {featuredOnly ? (
                <>Uitgelichte restaurants</>
              ) : dishQuery ? (
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
          
          {/* City + Filter row (below title, aligned right) */}
          {featuredOnly && (
            <div className="flex items-center justify-end gap-2">
              <Select value={selectedCityId} onValueChange={handleCityChange}>
                <SelectTrigger className="w-auto min-w-[140px] h-9">
                  <SelectValue placeholder="Kies stad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('cities.all')}</SelectItem>
                  {cities.map(city => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <FilterPopover 
                filters={filters}
                onFiltersChange={setFilters}
                availableCuisines={availableCuisines}
              />
            </div>
          )}

          {/* Sort & View controls row */}
          <div className="flex items-center justify-between gap-2">
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

            <div className="flex items-center gap-2">
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
                <SelectTrigger className="w-[130px] sm:w-44">
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
              
              {/* Filter Button - show on all viewports for non-featured pages */}
              {!featuredOnly && (
                <FilterPopover 
                  filters={filters}
                  onFiltersChange={setFilters}
                  availableCuisines={availableCuisines}
                />
              )}
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
            {filters.dietaryOptions.map(d => (
              <Badge 
                key={`diet-${d}`} 
                variant="secondary"
                className="cursor-pointer capitalize text-xs"
                onClick={() => toggleFilter('dietaryOptions', d)}
              >
                {d.replace('-', ' ')}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
            {filters.hasTerrace && (
              <Badge 
                variant="secondary"
                className="cursor-pointer text-xs"
                onClick={() => setFilters(prev => ({ ...prev, hasTerrace: undefined }))}
              >
                ☀️ Terras
                <X className="h-3 w-3 ml-1" />
              </Badge>
            )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : sortedResults.length > 0 ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6"
            >
              {displayedResults.map((restaurant, index) => (
                <motion.div
                  key={restaurant.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.05, 0.3) }}
                >
                  <DatabaseRestaurantCard restaurant={restaurant} isSponsored={restaurant.isSponsored} />
                </motion.div>
              ))}
            </motion.div>
            
            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={loadMore}
                  className="min-w-[200px]"
                >
                  Meer laden ({sortedResults.length - displayCount} resterend)
                </Button>
              </div>
            )}

            {/* SEO Internal Links */}
            <SeoLandingLinks
              currentDish={dishQuery}
              currentCity={selectedCityId !== 'all' ? selectedCityId : undefined}
              cities={cities.map(c => ({ id: c.id, name: c.name, slug: c.slug }))}
              dishes={dishes.slice(0, 10).map(d => ({ id: d.id, name: d.name, slug: d.slug }))}
            />
          </>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 md:py-24"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-6">
              <UtensilsCrossed className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Geen resultaten gevonden</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              {dishQuery 
                ? `We konden geen restaurants vinden voor "${dishQuery}"${selectedCityName ? ` in ${selectedCityName}` : ''}. Probeer een ander gerecht of verwijder je filters.`
                : 'Probeer een ander zoekwoord of pas je filters aan.'}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {activeFilterCount > 0 && (
                <Button variant="outline" onClick={clearFilters}>
                  Filters wissen
                </Button>
              )}
              {dishQuery && (
                <Button variant="outline" onClick={() => handleSearch('', 'all')}>
                  Alles tonen
                </Button>
              )}
              <Button onClick={() => navigate('/')}>
                Terug naar home
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-20 right-4 z-40 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors md:bottom-6 md:right-6"
            aria-label="Terug naar boven"
          >
            <ArrowUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </Layout>
  );
}
