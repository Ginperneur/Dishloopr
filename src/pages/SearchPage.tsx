import { useState, useEffect, useRef, lazy, Suspense, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Map, LayoutGrid, Navigation, Loader2, ArrowUp, UtensilsCrossed, Bookmark, BookmarkCheck, Clock } from 'lucide-react';
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
import { isOpenNow } from '@/lib/openingHours';
import { useGeolocation, calculateDistance } from '@/hooks/useGeolocation';
import { toast } from 'sonner';
import { useSavedSearches } from '@/hooks/useSavedSearches';
import { slugify } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

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
  radiusKm?: number;
}

export default function SearchPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { search, results, loading, cities, dishes, detectedCity, didYouMean, isFuzzyMatch, parsedQuery } = useSearch();
  const { isSaved, toggle: toggleSavedSearch } = useSavedSearches();
  
  // Accept both `?dish=` (internal) and `?q=` (external/SEO/shared links)
  const dishQuery = searchParams.get('dish') || searchParams.get('q') || '';
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

  // City detected in the query ("pizza in rotterdam") → move it into the URL.
  useEffect(() => {
    if (!detectedCity || searchParams.get('city')) return;
    const params = new URLSearchParams(searchParams);
    const slug = cities.find(c => c.id === detectedCity.id)?.slug;
    params.set('city', slug || detectedCity.id);
    params.delete('q');
    if (parsedQuery) params.set('dish', parsedQuery); else params.delete('dish');
    setSearchParams(params, { replace: true });
  }, [detectedCity, parsedQuery]);
  
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
  const [viewMode, setViewMode] = useState<ViewMode>(
    searchParams.get('view') === 'map' ? 'map' : 'grid'
  );
  // Restore list length + scroll position when returning via browser back.
  const scrollKey = `search-scroll:${searchParams.toString()}`;
  const restoreRef = useRef<{ y: number; count: number } | null | undefined>(undefined);
  if (restoreRef.current === undefined) {
    try { restoreRef.current = JSON.parse(sessionStorage.getItem(scrollKey) || 'null'); } catch { restoreRef.current = null; }
  }
  const [displayCount, setDisplayCount] = useState(() => restoreRef.current?.count ?? 12);
  const displayCountRef = useRef(displayCount);
  displayCountRef.current = displayCount;
  const scrollKeyRef = useRef(scrollKey);
  scrollKeyRef.current = scrollKey;
  useEffect(() => {
    let tId: number | undefined;
    const save = () => {
      try { sessionStorage.setItem(scrollKeyRef.current, JSON.stringify({ y: window.scrollY, count: displayCountRef.current })); } catch { /* ignore */ }
    };
    const onScroll = () => { window.clearTimeout(tId); tId = window.setTimeout(save, 150); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); window.clearTimeout(tId); };
  }, []);
  const [showScrollTop, setShowScrollTop] = useState(false);
  // Tracks an in-flight "Bij mij" click so we can switch to the map view
  // as soon as the browser returns the user's coordinates.
  const [pendingNearMe, setPendingNearMe] = useState(false);

  // Keep viewMode in sync with URL (?view=map) so BottomNav Map/Search tabs work
  useEffect(() => {
    const next: ViewMode = searchParams.get('view') === 'map' ? 'map' : 'grid';
    setViewMode((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  // When user toggles view via the buttons, reflect it in the URL
  const handleViewModeChange = (next: ViewMode) => {
    setViewMode(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'map') params.set('view', 'map');
    else params.delete('view');
    setSearchParams(params, { replace: true });
  };
  
  // Geolocation for "near me" feature
  const { latitude, longitude, loading: locationLoading, error: locationError, requestLocation } = useGeolocation();
  // Location passed from the homepage "Bij mij in de buurt" button (?near=lat,lng)
  const nearParam = searchParams.get('near');
  const nearLocation = useMemo(() => {
    if (!nearParam) return null;
    const [la, ln] = nearParam.split(',').map(Number);
    return Number.isFinite(la) && Number.isFinite(ln) ? { lat: la, lng: ln } : null;
  }, [nearParam]);
  const userLocation = latitude && longitude ? { lat: latitude, lng: longitude } : nearLocation;

  // Arriving with ?near → sort by distance automatically
  useEffect(() => {
    if (nearLocation) setSortBy('nearest');
  }, [nearLocation]);

  useEffect(() => {
    if (locationError) {
      toast.error(locationError);
      setPendingNearMe(false);
    }
  }, [locationError]);

  // Sync selectedCityId with resolved city ID
  useEffect(() => {
    setSelectedCityId(resolvedCityId);
  }, [resolvedCityId]);

  // Normalize dish casing in URL (avoid duplicate indexing) without redirecting
  // away to a pillar/in-between page — user-initiated searches must land on results.
  useEffect(() => {
    if (!dishQuery) return;
    const lower = dishQuery.toLowerCase().trim();
    if (dishQuery !== lower) {
      const params = new URLSearchParams(searchParams);
      params.set('dish', lower);
      setSearchParams(params, { replace: true });
    }
  }, [dishQuery, searchParams, setSearchParams]);

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
    // Wait until the city from the URL is synced (avoids a stale nationwide run after a URL rewrite)
    if (selectedCityId !== resolvedCityId) return;
    search(dishQuery, selectedCityId, filters, featuredOnly);
    if (restoreRef.current) return; // keep restored pagination when coming back
    setDisplayCount(12); // Reset pagination on new search
  }, [dishQuery, selectedCityId, resolvedCityId, filters, featuredOnly]);

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
    return results.filter(r => isOpenNow((r as any).opening_hours) === true);
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

  useSearchLogger({
    source: 'search',
    query: dishQuery,
    city: cityParam !== 'all' ? (cities.find((c: any) => c.id === cityParam)?.name ?? cityParam) : null,
    filters: {
      prijs: filters.priceLevel, sfeer: filters.ambienceTags, maaltijdtype: filters.mealTypes,
      open_nu: !!filters.openNow, dieet: filters.dietaryOptions, keuken: filters.cuisines,
      concept: filters.concepts, ervaring: filters.experiences,
    },
    resultsCount: openNowFiltered.length,
    ready: !loading && (!!dishQuery || cityParam !== 'all'),
  });

  // Scroll back to where the user was once restored results are on screen.
  useEffect(() => {
    const r = restoreRef.current;
    if (!r || loading || results.length === 0) return;
    restoreRef.current = null;
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, r.y)));
  }, [loading, results.length]);

  // Paginated results
  const displayedResults = useMemo(() => 
    sortedResults.slice(0, displayCount), 
    [sortedResults, displayCount]
  );
  // Stable list of restaurants passed to the map (recomputes only when data changes).
  const mapRestaurants = useMemo(
    () => sortedResults.map(r => ({
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
    })),
    [sortedResults],
  );
  const stableUserLocation = useMemo(
    () => (userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : null),
    [userLocation?.lat, userLocation?.lng],
  );
  const hasMore = displayCount < sortedResults.length;
  
  const loadMore = () => {
    setDisplayCount(prev => Math.min(prev + 12, sortedResults.length));
  };

  // Handle near me click
  const handleNearMe = () => {
    if (locationLoading) return;
    
    if (!userLocation) {
      setPendingNearMe(true);
      requestLocation();
      toast.info(t('search.locationToast', 'Locatie wordt opgehaald…'));
    } else {
      // Already have location — open map view centered on user immediately
      handleViewModeChange('map');
      setSortBy('nearest');
      toast.success(t('search.mapCentered', 'Kaart gecentreerd op jouw locatie'));
    }
  };

  // When a "Bij mij" click resolves, auto-open the map and sort by distance.
  useEffect(() => {
    if (userLocation && pendingNearMe) {
      setPendingNearMe(false);
      handleViewModeChange('map');
      setSortBy('nearest');
      toast.success(t('search.mapCentered', 'Kaart gecentreerd op jouw locatie'));
    }
  }, [userLocation, pendingNearMe]);

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
      radiusKm: 0,
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
    (filters.hasTerrace ? 1 : 0) +
    (filters.radiusKm && filters.radiusKm > 0 ? 1 : 0);

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
        ? t('search.bestDishInCity', { dish: dishQuery, city: selectedCityName, defaultValue: `Beste ${dishQuery} in ${selectedCityName}` })
        : t('search.dishRestaurantsInCountry', { dish: dishQuery, defaultValue: `${dishQuery} restaurants in Nederland` })
      : t('search.defaultTitle', 'Zoek restaurants');

  const pageDescription = dishQuery
    ? selectedCityName
      ? t('search.descDishInCity', { dish: dishQuery, city: selectedCityName, defaultValue: `Vind de beste ${dishQuery} restaurants in ${selectedCityName}.` })
      : t('search.descDishInCountry', { dish: dishQuery, defaultValue: `Vind de beste ${dishQuery} restaurants in Nederland.` })
    : selectedCityName
      ? t('search.descSearchInCity', { city: selectedCityName, defaultValue: `Zoek en ontdek restaurants in ${selectedCityName}.` })
      : t('search.descSearchInCountry', 'Zoek en ontdek restaurants in Nederland. Filter op gerecht, sfeer en prijs.');

  // Always use clean canonical to avoid duplicate indexing of filtered views
  const hasFilters = !!(dishQuery || (selectedCityId && selectedCityId !== 'all'));

  return (
    <Layout>
      <SEOHead
        title={`${pageTitle} | Dishloopr`}
        description={pageDescription}
        keywords={[dishQuery || 'restaurants', 'eten', 'uit eten', selectedCityName || 'Nederland', 'reviews'].filter(Boolean) as string[]}
        canonical="https://dishloopr.com/search"
        noindex={true}
        structuredData={createBreadcrumbSchema([
          { name: 'Home', url: 'https://dishloopr.com' },
          { name: pageTitle, url: 'https://dishloopr.com/search' },
        ])}
      />
      {/* Search Header — non-sticky on mobile to free vertical space */}
      <div className="md:sticky md:top-[4rem] z-40 bg-background border-b border-border py-3 md:py-4">
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
        {/* Breadcrumb — preserve back-context */}
        <nav aria-label={t('search.ariaCrumb', 'Kruimelpad')} className="text-xs md:text-sm text-muted-foreground mb-2">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li>
              <button
                onClick={() => navigate('/')}
                className="hover:text-foreground transition-colors"
              >
                {t('breadcrumb.home', 'Home')}
              </button>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <button
                onClick={() => navigate('/search')}
                className="hover:text-foreground transition-colors"
              >
                {t('breadcrumb.search', 'Zoeken')}
              </button>
            </li>
            {(dishQuery || (selectedCityName && selectedCityId !== 'all')) && (
              <>
                <li aria-hidden="true">/</li>
                <li className="text-foreground font-medium truncate max-w-[60vw]">
                  {dishQuery && <span>{dishQuery}</span>}
                  {dishQuery && selectedCityName && <span> in </span>}
                  {selectedCityName && <span>{selectedCityName}</span>}
                </li>
              </>
            )}
          </ol>
        </nav>

        {/* Results Header */}
        <div className="flex flex-col gap-3 mb-4 md:mb-6">
          {/* Title row */}
          <div>
            <h1 className="text-xl md:text-2xl font-bold">
              {featuredOnly ? (
                <>{t('search.featuredTitleHeading', 'Uitgelichte restaurants')}</>
              ) : dishQuery ? (
                <>
                  {dishQuery} {cityName && `in ${cityName}`}
                </>
              ) : (
                <>{cityName ? t('search.restaurantsInCity', { city: cityName, defaultValue: `Restaurants in ${cityName}` }) : 'Restaurants'}</>
              )}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {loading ? t('search.searching', 'Zoeken...') : `${sortedResults.length} ${t('search.results')}`}
            </p>
          </div>
          
          {/* City + Filter row (below title, aligned right) */}
          {featuredOnly && (
            <div className="flex items-center justify-end gap-2">
              <Select value={selectedCityId} onValueChange={handleCityChange}>
                <SelectTrigger className="w-auto min-w-[140px] h-9">
                  <SelectValue placeholder={t('search.pickCity', 'Kies stad')} />
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

          {/* Sort & View controls row — stacks on mobile to prevent overflow */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Near Me Button */}
              <Button
                variant={sortBy === 'nearest' ? 'default' : 'outline'}
                size="sm"
                onClick={handleNearMe}
                disabled={locationLoading}
              >
                {locationLoading ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4 mr-1.5" />
                )}
                <span className="hidden sm:inline">{t('search.nearMe', 'Bij mij')}</span>
              </Button>

              {/* Open Now quick filter — surfaced early in the flow */}
              <Button
                variant={filters.openNow ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    openNow: prev.openNow ? undefined : true,
                  }))
                }
                aria-pressed={!!filters.openNow}
              >
                <Clock className="h-4 w-4 mr-1.5" />
                <span>{t('search.openNow', 'Open nu')}</span>
              </Button>

              {/* Save Search Button — only meaningful when there is a query/city */}
              {(dishQuery || (selectedCityId && selectedCityId !== 'all') || cuisineParam) && (() => {
                const parts = {
                  dish: dishQuery || undefined,
                  city: selectedCityId !== 'all' ? selectedCityId : undefined,
                  cityName: selectedCityName || undefined,
                  cuisine: cuisineParam || undefined,
                };
                const saved = isSaved(parts);
                const label = [dishQuery, selectedCityName].filter(Boolean).join(' • ') || cuisineParam || t('search.searchLabel', 'Zoekopdracht');
                const url = `/search?${searchParams.toString()}`;
                return (
                  <Button
                    variant={saved ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      const nowSaved = toggleSavedSearch({ ...parts, label, url });
                      toast.success(nowSaved ? t('search.queryToast', 'Zoekopdracht opgeslagen') : t('search.queryRemovedToast', 'Zoekopdracht verwijderd'));
                    }}
                    aria-pressed={saved}
                  >
                    {saved ? (
                      <BookmarkCheck className="h-4 w-4 mr-1.5" />
                    ) : (
                      <Bookmark className="h-4 w-4 mr-1.5" />
                    )}
                    <span className="hidden sm:inline">{saved ? t('search.saved', 'Opgeslagen') : t('search.save', 'Bewaar')}</span>
                  </Button>
                );
              })()}
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {/* View Mode Toggle */}
              <div className="flex items-center border border-border rounded-lg p-0.5">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => handleViewModeChange('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'map' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => handleViewModeChange('map')}
                >
                  <Map className="h-4 w-4" />
                </Button>
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="flex-1 sm:flex-none sm:w-44 min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bestMatch">{t('sort.bestMatch')}</SelectItem>
                  <SelectItem value="highestRated">{t('sort.highestRated')}</SelectItem>
                  <SelectItem value="mostReviews">{t('sort.mostReviews')}</SelectItem>
                  <SelectItem value="priceLowHigh">{t('sort.priceLowHigh')}</SelectItem>
                  <SelectItem value="priceHighLow">{t('sort.priceHighLow')}</SelectItem>
                  {userLocation && <SelectItem value="nearest">{t('search.nearestSort', 'Dichtstbij')}</SelectItem>}
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
                ☀️ {t('filters.terraceLabel', 'Terras')}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            )}
            {filters.radiusKm && filters.radiusKm > 0 && (
              <Badge
                variant="secondary"
                className="cursor-pointer text-xs"
                onClick={() => setFilters(prev => ({ ...prev, radiusKm: 0 }))}
              >
                📍 +{filters.radiusKm} km rond stad
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
            <div className="h-[calc(100svh-12rem)] md:h-[60vh] min-h-[400px] rounded-xl overflow-hidden border border-border">
              <RestaurantMap
                restaurants={mapRestaurants}
                userLocation={stableUserLocation}
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
            {isFuzzyMatch && didYouMean && (
              <p className="mb-4 text-sm text-muted-foreground">
                Resultaten voor <span className="font-semibold text-foreground">{didYouMean.charAt(0).toUpperCase() + didYouMean.slice(1)}</span>
              </p>
            )}
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
                  {t('search.loadMore', { remaining: sortedResults.length - displayCount, defaultValue: `Meer laden (${sortedResults.length - displayCount} resterend)` })}
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
            <h3 className="text-xl font-semibold mb-2">
              {dishQuery ? `Geen restaurants gevonden voor ${dishQuery}` : t('search.noResultsTitle', 'Geen resultaten gevonden')}
            </h3>
            {dishQuery && didYouMean && (
              <Button
                className="mb-4"
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set('dish', didYouMean);
                  const c = searchParams.get('city');
                  if (c) params.set('city', c);
                  navigate(`/search?${params.toString()}`);
                }}
              >
                Bedoelde je {didYouMean}?
              </Button>
            )}
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              {filters.dietaryOptions.length > 0
                ? t('search.noResultsDietary', 'Nog geen restaurants met dit filter — dit groeit zodra restaurants hun gerechten taggen.')
                : dishQuery 
                ? t('search.noResultsDish', { dish: dishQuery, cityPart: selectedCityName ? t('search.inCityPart', { city: selectedCityName, defaultValue: ` in ${selectedCityName}` }) : '', defaultValue: `We konden geen restaurants vinden voor "${dishQuery}". Probeer een ander gerecht of verwijder je filters.` })
                : t('search.noResultsGeneric', 'Probeer een ander zoekwoord of pas je filters aan.')}
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {activeFilterCount > 0 && (
                <Button variant="outline" onClick={clearFilters}>
                  {t('search.clearFilters', 'Filters wissen')}
                </Button>
              )}
              {dishQuery && (
                <Button variant="outline" onClick={() => handleSearch('', 'all')}>
                  {t('search.showAll', 'Alles tonen')}
                </Button>
              )}
              <Button onClick={() => navigate('/')}>
                {t('search.backHome', 'Terug naar home')}
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
            aria-label={t('search.scrollTop', 'Terug naar boven')}
          >
            <ArrowUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </Layout>
  );
}
